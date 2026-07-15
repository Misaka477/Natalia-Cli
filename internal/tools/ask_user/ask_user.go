package ask_user

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

type AskUser struct{}

type Handler func(context.Context, wire.QuestionRequest) (wire.QuestionResponse, error)

var (
	handlerMu sync.RWMutex
	handler   Handler
)

func SetHandler(fn Handler) func() {
	handlerMu.Lock()
	previous := handler
	handler = fn
	handlerMu.Unlock()
	return func() {
		handlerMu.Lock()
		handler = previous
		handlerMu.Unlock()
	}
}

func (t *AskUser) Name() string { return "ask_user" }
func (t *AskUser) Description() string {
	return "ask the user for additional input; supports single question or questions array, options, multi-select, custom input, and timeout fallback"
}
func (t *AskUser) Required() []string { return []string{} }
func (t *AskUser) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"question":     {Type: "string", Description: "question to ask the user; shorthand for single-question mode"},
		"name":         {Type: "string", Description: "optional, answer key name for single question; default answer"},
		"options":      {Type: "array", Description: "optional, option array for single question"},
		"multiple":     {Type: "boolean", Description: "optional, allow multi-select"},
		"allow_custom": {Type: "boolean", Description: "optional, allow custom input"},
		"fallback":     {Type: "string", Description: "optional, default answer on timeout/AFK"},
		"timeout":      {Type: "integer", Description: "optional, seconds to wait for user; default no timeout, range 1-3600"},
		"questions":    {Type: "array", Description: "optional, structured question array; each item contains name/question/options/multiple/allow_custom/fallback"},
	}
}
func (t *AskUser) Execute(args map[string]any) (string, error) {
	req, err := BuildQuestionRequest(args)
	if err != nil {
		return "", err
	}
	ctx := context.Background()
	if req.TimeoutMS > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(req.TimeoutMS)*time.Millisecond)
		defer cancel()
	}
	resp, err := ask(ctx, req)
	if err != nil {
		if req.TimeoutMS > 0 || ctx.Err() != nil {
			if resp.Sources == nil {
				resp.Sources = make(map[string]string, len(req.Questions))
			}
			for _, q := range req.Questions {
				if strings.TrimSpace(resp.Answers[q.Name]) == "" {
					resp.Sources[q.Name] = "timeout"
				} else {
					resp.Sources[q.Name] = "user"
				}
			}
			resp = applyQuestionFallbacks(req, resp)
			return formatAnswers(resp), nil
		}
		return "", err
	}
	resp.Sources = answerSource(req, resp)
	resp = applyQuestionFallbacks(req, resp)
	return formatAnswers(resp), nil
}

func BuildQuestionRequest(args map[string]any) (wire.QuestionRequest, error) {
	questions, err := parseQuestions(args)
	if err != nil {
		return wire.QuestionRequest{}, err
	}
	if len(questions) == 0 {
		return wire.QuestionRequest{}, fmt.Errorf("question 或 questions 是必填参数")
	}
	if len(questions) > 4 {
		return wire.QuestionRequest{}, fmt.Errorf("questions 最多支持 4 个问题")
	}
	for i := range questions {
		if questions[i].Name == "" {
			questions[i].Name = fmt.Sprintf("answer_%d", i+1)
		}
		if questions[i].Question == "" {
			return wire.QuestionRequest{}, fmt.Errorf("questions[%d].question 是必填参数", i)
		}
		if len(questions[i].Options) > 4 {
			return wire.QuestionRequest{}, fmt.Errorf("questions[%d].options 最多支持 4 个选项", i)
		}
	}
	timeout, err := parseTimeoutMS(args["timeout"])
	if err != nil {
		return wire.QuestionRequest{}, err
	}
	return wire.QuestionRequest{ID: fmt.Sprintf("ask_user_%d", time.Now().UnixNano()), Questions: questions, TimeoutMS: timeout}, nil
}

func parseQuestions(args map[string]any) ([]wire.QuestionItem, error) {
	if raw, ok := args["questions"]; ok && raw != nil {
		items, ok := raw.([]any)
		if !ok {
			return nil, fmt.Errorf("questions must be an array")
		}
		questions := make([]wire.QuestionItem, 0, len(items))
		for i, item := range items {
			m, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("questions[%d] must be an object", i)
			}
			q, err := parseQuestionItem(m, i)
			if err != nil {
				return nil, err
			}
			questions = append(questions, q)
		}
		return questions, nil
	}
	question, _ := args["question"].(string)
	if strings.TrimSpace(question) == "" {
		return nil, nil
	}
	q, err := parseQuestionItem(args, 0)
	if err != nil {
		return nil, err
	}
	if q.Name == "" {
		q.Name = "answer"
	}
	return []wire.QuestionItem{q}, nil
}

func parseQuestionItem(args map[string]any, index int) (wire.QuestionItem, error) {
	question, _ := args["question"].(string)
	name, _ := args["name"].(string)
	fallback, _ := args["fallback"].(string)
	options, err := parseStringSlice(args["options"])
	if err != nil {
		return wire.QuestionItem{}, fmt.Errorf("questions[%d].options must be a string array", index)
	}
	return wire.QuestionItem{Name: strings.TrimSpace(name), Question: strings.TrimSpace(question), Options: options, Multiple: parseBool(args["multiple"]), AllowCustom: parseBool(args["allow_custom"]), Fallback: fallback}, nil
}

func parseStringSlice(raw any) ([]string, error) {
	if raw == nil {
		return nil, nil
	}
	switch v := raw.(type) {
	case []string:
		return v, nil
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			text, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("non-string option")
			}
			out = append(out, text)
		}
		return out, nil
	case string:
		if strings.TrimSpace(v) == "" {
			return nil, nil
		}
		parts := strings.Split(v, ",")
		out := make([]string, 0, len(parts))
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part != "" {
				out = append(out, part)
			}
		}
		return out, nil
	default:
		return nil, fmt.Errorf("invalid options")
	}
}

func parseBool(raw any) bool {
	switch v := raw.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(strings.TrimSpace(v), "true") || strings.TrimSpace(v) == "1" || strings.EqualFold(strings.TrimSpace(v), "yes")
	default:
		return false
	}
}

func parseTimeoutMS(raw any) (int64, error) {
	if raw == nil {
		return 0, nil
	}
	var seconds int64
	switch v := raw.(type) {
	case int:
		seconds = int64(v)
	case int64:
		seconds = v
	case float64:
		if v != float64(int64(v)) {
			return 0, fmt.Errorf("timeout must be an integer number of seconds")
		}
		seconds = int64(v)
	case string:
		if strings.TrimSpace(v) == "" {
			return 0, nil
		}
		parsed, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("timeout must be an integer number of seconds")
		}
		seconds = parsed
	default:
		return 0, fmt.Errorf("timeout must be an integer number of seconds")
	}
	if seconds < 0 || seconds > 3600 {
		return 0, fmt.Errorf("timeout must be between 0 and 3600 seconds")
	}
	return seconds * int64(time.Second/time.Millisecond), nil
}

func ask(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
	handlerMu.RLock()
	fn := handler
	handlerMu.RUnlock()
	if fn != nil {
		return fn(ctx, req)
	}
	return askStdin(ctx, req)
}

func askStdin(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
	answers := make(map[string]string, len(req.Questions))
	sources := make(map[string]string, len(req.Questions))
	reader := bufio.NewReader(os.Stdin)
	for _, question := range req.Questions {
		fmt.Fprintf(os.Stderr, "\n[提问] %s\n", question.Question)
		for i, option := range question.Options {
			fmt.Fprintf(os.Stderr, "%d. %s\n", i+1, option)
		}
		if question.Multiple {
			fmt.Fprintln(os.Stderr, "可多选，请用逗号分隔")
		}
		if question.AllowCustom {
			fmt.Fprintln(os.Stderr, "可输入自定义答案")
		}
		fmt.Fprint(os.Stderr, "> ")
		answerCh := make(chan string, 1)
		go func() {
			answer, _ := reader.ReadString('\n')
			answerCh <- strings.TrimSpace(answer)
		}()
		select {
		case <-ctx.Done():
			sources[question.Name] = "timeout"
			answers[question.Name] = ""
		case answer := <-answerCh:
			answers[question.Name] = normalizeAnswer(question, answer)
			sources[question.Name] = "user"
		}
	}
	return wire.QuestionResponse{RequestID: req.ID, Answers: answers, Sources: sources}, nil
}

func normalizeAnswer(question wire.QuestionItem, answer string) string {
	if len(question.Options) == 0 {
		return answer
	}
	if question.Multiple {
		parts := strings.Split(answer, ",")
		selected := make([]string, 0, len(parts))
		for _, part := range parts {
			if option, ok := optionByInput(question.Options, part); ok {
				selected = append(selected, option)
			} else if question.AllowCustom && strings.TrimSpace(part) != "" {
				selected = append(selected, strings.TrimSpace(part))
			}
		}
		return strings.Join(selected, ", ")
	}
	if option, ok := optionByInput(question.Options, answer); ok {
		return option
	}
	if question.AllowCustom {
		return answer
	}
	return ""
}

func optionByInput(options []string, raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	if idx, err := strconv.Atoi(raw); err == nil && idx >= 1 && idx <= len(options) {
		return options[idx-1], true
	}
	for _, option := range options {
		if strings.EqualFold(strings.TrimSpace(option), raw) {
			return option, true
		}
	}
	return "", false
}

func answerSource(req wire.QuestionRequest, resp wire.QuestionResponse) map[string]string {
	sources := make(map[string]string, len(req.Questions))
	for _, q := range req.Questions {
		if src, ok := resp.Sources[q.Name]; ok {
			sources[q.Name] = src
		} else if strings.TrimSpace(resp.Answers[q.Name]) != "" {
			sources[q.Name] = "user"
		} else if q.Fallback != "" {
			sources[q.Name] = "fallback"
		} else {
			sources[q.Name] = "timeout"
		}
	}
	return sources
}

func applyQuestionFallbacks(req wire.QuestionRequest, resp wire.QuestionResponse) wire.QuestionResponse {
	if resp.RequestID == "" {
		resp.RequestID = req.ID
	}
	if resp.Answers == nil {
		resp.Answers = make(map[string]string)
	}
	for _, question := range req.Questions {
		if strings.TrimSpace(resp.Answers[question.Name]) == "" && question.Fallback != "" {
			resp.Answers[question.Name] = question.Fallback
		}
	}
	return resp
}

func formatAnswers(resp wire.QuestionResponse) string {
	if len(resp.Answers) == 0 {
		return "未收到用户回答"
	}
	if len(resp.Answers) == 1 {
		for name, answer := range resp.Answers {
			if source := resp.Sources[name]; source != "" && source != "user" {
				return answer + "\n(answer source: " + source + ")"
			}
			return answer
		}
	}
	keys := make([]string, 0, len(resp.Answers))
	for key := range resp.Answers {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, key := range keys {
		if b.Len() > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "%s: %s", key, resp.Answers[key])
		if source := resp.Sources[key]; source != "" && source != "user" {
			fmt.Fprintf(&b, " (%s)", source)
		}
	}
	return b.String()
}
