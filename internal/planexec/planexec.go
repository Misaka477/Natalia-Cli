package planexec

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

type Step struct {
	Line int
	Text string
	Done bool
}

type Session struct {
	Path    string
	Slug    string
	Content string
	Steps   []Step
}

func Parse(path string, content string) *Session {
	steps := parseSteps(content)
	return &Session{
		Path:    path,
		Slug:    slugFromPath(path),
		Content: content,
		Steps:   steps,
	}
}

func (s *Session) NextOpenStep() (Step, bool) {
	if s == nil {
		return Step{}, false
	}
	for _, step := range s.Steps {
		if !step.Done {
			return step, true
		}
	}
	return Step{}, false
}

func (s *Session) MarkNextDone() (Step, bool) {
	if s == nil {
		return Step{}, false
	}
	for i, step := range s.Steps {
		if !step.Done {
			s.Steps[i].Done = true
			step.Done = true
			return step, true
		}
	}
	return Step{}, false
}

func (s *Session) StatusLines() []string {
	if s == nil {
		return []string{"plan: <none>"}
	}
	done := 0
	for _, step := range s.Steps {
		if step.Done {
			done++
		}
	}
	lines := []string{
		fmt.Sprintf("plan: %s", s.Slug),
		fmt.Sprintf("plan_path: %s", s.Path),
		fmt.Sprintf("plan_steps: %d/%d done", done, len(s.Steps)),
	}
	if step, ok := s.NextOpenStep(); ok {
		lines = append(lines, fmt.Sprintf("next_step: line %d: %s", step.Line, step.Text))
	}
	return lines
}

func (s *Session) Instruction() string {
	if s == nil {
		return ""
	}
	next := "未找到 checklist 未完成项；请阅读计划并选择下一个可验证小块。"
	if step, ok := s.NextOpenStep(); ok {
		next = fmt.Sprintf("下一未完成项（line %d）：%s", step.Line, step.Text)
	}
	return fmt.Sprintf("按以下计划继续执行。先处理指定的下一未完成小块，完成后运行局部测试；不要跳过大阶段。\n\n计划文件: %s\n计划 slug: %s\n%s\n\n%s", s.Path, s.Slug, next, s.Content)
}

var checklistRe = regexp.MustCompile(`^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$`)

func parseSteps(content string) []Step {
	lines := strings.Split(content, "\n")
	steps := make([]Step, 0)
	inFence := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}
		m := checklistRe.FindStringSubmatch(line)
		if len(m) != 3 {
			continue
		}
		steps = append(steps, Step{
			Line: i + 1,
			Text: strings.TrimSpace(m[2]),
			Done: strings.EqualFold(m[1], "x"),
		})
	}
	return steps
}

var nonSlugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugFromPath(path string) string {
	base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	slug := strings.Trim(nonSlugRe.ReplaceAllString(strings.ToLower(base), "-"), "-")
	if slug == "" {
		return "plan"
	}
	return slug
}
