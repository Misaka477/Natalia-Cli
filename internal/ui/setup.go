package ui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/aquama/natalia-cli/internal/config"
)

func ask(p survey.Prompt, response interface{}, opts ...survey.AskOpt) error {
	err := survey.AskOne(p, response, opts...)
	if err != nil && strings.Contains(err.Error(), "interrupt") {
		return fmt.Errorf("interrupt")
	}
	return err
}

func askInput(msg string, target *string, opts ...survey.AskOpt) error {
	return ask(&survey.Input{Message: msg}, target, opts...)
}

func askPassword(msg string, target *string) error {
	return ask(&survey.Password{Message: msg}, target)
}

func SetupFlow(cfg *config.Config) bool {
	_, _, err := cfg.ActiveProfile()
	hasConfig := err == nil

	var options []string
	if hasConfig {
		options = []string{"查看当前配置", "修改当前配置", "添加新配置", "删除配置", "取消"}
	} else {
		options = []string{"添加配置", "取消"}
	}

	action := ""
	if err := ask(&survey.Select{Message: "配置", Options: options}, &action); err != nil {
		return false
	}

	switch action {
	case "取消":
		return false
	case "添加配置", "添加新配置":
		return addProfile(cfg)
	case "查看当前配置":
		ShowConfig(cfg)
		return false
	case "修改当前配置":
		editProfile(cfg)
		cfg.Save()
		return true
	case "删除配置":
		return deleteProfile(cfg)
	}
	return false
}

func addProfile(cfg *config.Config) bool {
	name := ""
	if err := askInput("配置名称", &name, survey.WithValidator(survey.Required)); err != nil {
		return false
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	if _, exists := cfg.Profiles[name]; exists {
		fmt.Printf("配置 %q 已存在，将覆盖\n", name)
	}

	p := config.Provider{}
	if err := askInput("API 地址", &p.BaseURL, survey.WithValidator(survey.Required)); err != nil {
		return false
	}
	if err := askPassword("API Key", &p.APIKey); err != nil {
		return false
	}

	providerName := name
	cfg.Providers[providerName] = p

	modelName, maxCtx := tryPickModel(p.BaseURL, p.APIKey)
	if modelName == "" {
		if err := askInput("模型名称", &modelName, survey.WithValidator(survey.Required)); err != nil {
			return false
		}
		maxCtx = DetectContext(modelName)
	}
	if maxCtx == 0 {
		maxCtx = 128000
	}

	pr := config.Profile{
		Provider:   providerName,
		Model:      modelName,
		MaxContext: maxCtx,
		Temperature: 0.0,
		MaxTokens:   8192,
		TopP:        1.0,
		Stream:      true,
		MaxSteps:    50,
		TimeoutSec:  120,
	}
	cfg.Profiles[name] = pr
	cfg.DefaultProfile = name
	cfg.Save()
	fmt.Printf("✓ 配置 %q 完成，当前模型: %s\n", name, modelName)
	return true
}

func ShowConfig(cfg *config.Config) {
	if cfg == nil {
		fmt.Println("未配置")
		return
	}
	pr, p, err := cfg.ActiveProfile()
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Printf("配置名称:   %s\n", cfg.DefaultProfile)
	fmt.Printf("模型:       %s\n", pr.Model)
	fmt.Printf("服务商:     %s\n", pr.Provider)
	fmt.Printf("API 地址:   %s\n", p.BaseURL)
	fmt.Printf("API Key:    %s…\n", maskKey(p.APIKey))
	fmt.Printf("上下文窗口: %d\n", pr.MaxContext)
	fmt.Printf("温度:       %.1f\n", pr.Temperature)
	fmt.Printf("最大令牌:   %d\n", pr.MaxTokens)
	fmt.Printf("Top P:      %.1f\n", pr.TopP)
	if pr.ThinkingEnabled {
		s := fmt.Sprintf("推理:       开启")
		if pr.ReasoningEffort != "" {
			s += fmt.Sprintf(" (强度: %s)", pr.ReasoningEffort)
		}
		fmt.Println(s)
	} else {
		fmt.Println("推理:       关闭")
	}
	if pr.Stream {
		fmt.Println("流式输出:   开启")
	} else {
		fmt.Println("流式输出:   关闭")
	}
	fmt.Printf("最大步骤:   %d\n", pr.MaxSteps)
	fmt.Printf("超时:       %ds\n", pr.TimeoutSec)
	if pr.SystemPrompt != "" {
		fmt.Printf("系统提示词: %s…\n", shorten(pr.SystemPrompt, 40))
	}
	if pr.WorkDir != "" {
		fmt.Printf("工作目录:   %s\n", pr.WorkDir)
	}
}

func editProfile(cfg *config.Config) {
	pr, p, _ := cfg.ActiveProfile()
	name := cfg.DefaultProfile

	for {
		action := ""
		thinkingLabel := "开启推理"
		if pr.ThinkingEnabled {
			thinkingLabel = "关闭推理"
		}
		streamLabel := "开启流式输出"
		if pr.Stream {
			streamLabel = "关闭流式输出"
		}
		approvalLabel := fmt.Sprintf("审批模式: %s", pr.AutoApprove)
		if pr.AutoApprove == "" {
			approvalLabel = "审批模式: ask"
		}
		opts := []string{
			"切换配置",
			"重命名配置",
			fmt.Sprintf("API 地址 (%s)", shorten(p.BaseURL, 30)),
			"API Key",
			thinkingLabel,
			streamLabel,
			approvalLabel,
			fmt.Sprintf("温度 (%.1f)", pr.Temperature),
			fmt.Sprintf("最大令牌 (%d)", pr.MaxTokens),
			fmt.Sprintf("Top P (%.1f)", pr.TopP),
			fmt.Sprintf("上下文窗口 (%d)", pr.MaxContext),
			"最大步骤数",
			"超时秒数",
			"系统提示词",
			"工作目录",
			"返回",
		}
		if pr.ThinkingEnabled {
			effortLabel := "推理强度: 默认"
			if pr.ReasoningEffort != "" {
				effortLabel = "推理强度: " + pr.ReasoningEffort
			}
			opts = append(opts[:6], append([]string{effortLabel}, opts[6:]...)...)
		}
		if err := ask(&survey.Select{Message: "修改配置", Options: opts}, &action); err != nil {
			return
		}

		switch {
		case action == "返回":
			return
		case action == "切换配置":
			picked := PickProfile(cfg)
			if picked != "" {
				cfg.DefaultProfile = picked
				pr, p, _ = cfg.ActiveProfile()
				name = picked
			}
		case action == "重命名配置":
			newName := ""
			askInput("新名称", &newName)
			newName = strings.TrimSpace(newName)
			if newName != "" && newName != name {
				cfg.Profiles[newName] = *pr
				delete(cfg.Profiles, name)
				cfg.DefaultProfile = newName
				pr, p, _ = cfg.ActiveProfile()
				name = newName
			}
		case strings.HasPrefix(action, "API 地址"):
			url := p.BaseURL
			askInput("API 地址", &url)
			if url != "" && url != p.BaseURL {
				p.BaseURL = url
				cfg.Providers[pr.Provider] = *p
			}
		case action == "API Key":
			key := ""
			askPassword("新 API Key", &key)
			if key != "" {
				p.APIKey = key
				cfg.Providers[pr.Provider] = *p
			}
		case strings.HasPrefix(action, "推理强度"):
			effort := pr.ReasoningEffort
			if effort == "" {
				effort = "默认"
			}
			opts := []string{"默认", "low", "medium", "high", "max"}
			selected := effort
			ask(&survey.Select{Message: "推理强度", Options: opts, Default: effort}, &selected)
			if selected == "默认" {
				pr.ReasoningEffort = ""
			} else {
				pr.ReasoningEffort = selected
			}
		case strings.Contains(action, "推理"):
			pr.ThinkingEnabled = !pr.ThinkingEnabled
			if !pr.ThinkingEnabled {
				pr.ReasoningEffort = ""
			}
		case strings.Contains(action, "流式"):
			pr.Stream = !pr.Stream
		case strings.HasPrefix(action, "审批模式"):
			modes := []string{"fuck", "ask", "read_only"}
			current := pr.AutoApprove
			if current == "" {
				current = "ask"
			}
			selected := current
			ask(&survey.Select{Message: "审批模式", Options: modes, Default: current}, &selected)
			pr.AutoApprove = selected
		case strings.HasPrefix(action, "温度"):
			v := fmt.Sprintf("%.1f", pr.Temperature)
			askInput("温度 (0-2)", &v)
			fmt.Sscanf(v, "%f", &pr.Temperature)
		case strings.HasPrefix(action, "最大令牌"):
			v := fmt.Sprintf("%d", pr.MaxTokens)
			askInput("最大令牌", &v)
			fmt.Sscanf(v, "%d", &pr.MaxTokens)
		case strings.HasPrefix(action, "Top P"):
			v := fmt.Sprintf("%.1f", pr.TopP)
			askInput("Top P (0-1)", &v)
			fmt.Sscanf(v, "%f", &pr.TopP)
		case strings.HasPrefix(action, "上下文窗口"):
			v := fmt.Sprintf("%d", pr.MaxContext)
			askInput("上下文窗口大小", &v)
			n := 0
			fmt.Sscanf(v, "%d", &n)
			if n > 0 {
				pr.MaxContext = n
			}
		case action == "最大步骤数":
			v := fmt.Sprintf("%d", pr.MaxSteps)
			askInput("最大步骤数", &v)
			fmt.Sscanf(v, "%d", &pr.MaxSteps)
		case action == "超时秒数":
			v := fmt.Sprintf("%d", pr.TimeoutSec)
			askInput("超时秒数", &v)
			fmt.Sscanf(v, "%d", &pr.TimeoutSec)
		case action == "系统提示词":
			askInput("系统提示词", &pr.SystemPrompt)
		case action == "工作目录":
			askInput("工作目录", &pr.WorkDir)
		}

		// write back profile after each edit
		cfg.Profiles[name] = *pr
	}
}

func deleteProfile(cfg *config.Config) bool {
	profiles := cfg.ProfileList()
	if len(profiles) <= 1 {
		fmt.Println("至少保留一个配置")
		return false
	}

	name := PickProfile(cfg)
	if name == "" || name == cfg.DefaultProfile {
		fmt.Println("已取消")
		return false
	}

	confirm := ""
	ask(&survey.Input{Message: fmt.Sprintf("确认删除 %q？输入 y 确认", name)}, &confirm)
	if strings.TrimSpace(confirm) != "y" {
		fmt.Println("已取消")
		return false
	}

	delete(cfg.Profiles, name)
	if cfg.DefaultProfile == name {
		// switch to first available
		for n := range cfg.Profiles {
			cfg.DefaultProfile = n
			break
		}
	}
	fmt.Printf("已删除配置: %s\n", name)
	return true
}

func PickProfile(cfg *config.Config) string {
	profiles := cfg.ProfileList()
	if len(profiles) == 0 {
		fmt.Println("没有已配置的配置项")
		return ""
	}

	options := make([]string, len(profiles))
	current := 0
	for i, name := range profiles {
		pr := cfg.Profiles[name]
		options[i] = name + "  (" + pr.Model + ")"
		if name == cfg.DefaultProfile {
			current = i
		}
	}

	selected := ""
	if err := ask(&survey.Select{
		Message: "选择配置",
		Options: options,
		Default: options[current],
	}, &selected); err != nil {
		return ""
	}

	for _, name := range profiles {
		if strings.HasPrefix(selected, name+"  (") {
			return name
		}
	}
	return ""
}

func DetectContext(modelName string) int {
	known := map[string]int{
		"step-3.7-flash":   131072,
		"step-3.5-flash":   131072,
		"step-4.0-flash":   262144,
		"step-router-v1":   262144,
		"gpt-4o":           128000,
		"gpt-4o-mini":      128000,
		"gpt-4.1":          1048576,
		"deepseek-chat":    65536,
		"deepseek-reasoner": 65536,
		"claude-sonnet-4":  200000,
		"claude-3.5-sonnet": 200000,
	}
	if n, ok := known[modelName]; ok {
		return n
	}
	for prefix, n := range map[string]int{
		"step-":   131072,
		"gpt-4":   128000,
		"gpt-3.5": 16384,
		"deepseek": 65536,
		"claude":  200000,
		"gemini":  1048576,
		"qwen":    131072,
		"glm":     131072,
	} {
		if strings.HasPrefix(modelName, prefix) {
			return n
		}
	}
	return 128000
}

func tryPickModel(baseURL, apiKey string) (string, int) {
	url := strings.TrimRight(baseURL, "/")
	if idx := strings.LastIndex(url, "/chat/completions"); idx > 0 {
		url = url[:idx]
	}
	if strings.HasSuffix(url, "/v1") {
		url = url + "/models"
	} else {
		url = url + "/v1/models"
	}

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return "", 0
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Data) == 0 {
		return "", 0
	}

	options := make([]string, len(result.Data))
	for i, m := range result.Data {
		options[i] = m.ID
	}

	selected := ""
	ask(&survey.Select{Message: "选择模型", Options: options}, &selected)
	if selected == "" {
		return "", 0
	}
	return selected, DetectContext(selected)
}

func shorten(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}

func maskKey(key string) string {
	if len(key) <= 8 {
		return "***"
	}
	return key[:4] + "..." + key[len(key)-4:]
}
