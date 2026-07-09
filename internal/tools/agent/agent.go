package agent

import (
	"fmt"
	"strings"

	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/worker"
	"github.com/aquama/natalia-cli/internal/toolset"
)

type Spawn struct {
	Pool   *worker.Pool
	Client *llm.Client
	Tools  *toolset.Registry
}

func (t *Spawn) Name() string        { return "agent_spawn" }
func (t *Spawn) Description() string { return "创建一个子 agent 执行独立任务" }
func (t *Spawn) Required() []string  { return []string{"task"} }
func (t *Spawn) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"task": {Type: "string", Description: "子 agent 要执行的任务描述"},
		"rule": {Type: "string", Description: "规则（code/ask/plan/debug/chat），默认 code"},
	}
}
func (t *Spawn) Execute(args map[string]any) (string, error) {
	task, _ := args["task"].(string)
	if task == "" {
		return "", fmt.Errorf("task 是必填参数")
	}
	if t.Pool == nil {
		return "", fmt.Errorf("子 agent 系统不可用")
	}
	ruleName, _ := args["rule"].(string)
	if ruleName == "" {
		ruleName = "code"
	}
	w, err := t.Pool.Spawn(task, ruleName, t.Client, t.Tools)
	if err != nil {
		return "", fmt.Errorf("创建子 agent 失败: %w", err)
	}
	return fmt.Sprintf("子 agent %s 已创建\n任务: %s\n规则: %s\n状态: %s", w.ID, task, ruleName, w.Status), nil
}

type List struct{ Pool *worker.Pool }

func (t *List) Name() string        { return "agent_list" }
func (t *List) Description() string { return "列出所有子 agent 及其状态" }
func (t *List) Required() []string  { return []string{} }
func (t *List) Parameters() map[string]llm.Property { return map[string]llm.Property{} }
func (t *List) Execute(args map[string]any) (string, error) {
	workers := t.Pool.List()
	if len(workers) == 0 {
		return "没有子 agent", nil
	}
	var b strings.Builder
	for _, w := range workers {
		logs := w.GetLogs()
		last := ""
		if len(logs) > 0 {
			last = logs[len(logs)-1].Tool
			if last == "" {
				last = logs[len(logs)-1].Result
			}
		}
		b.WriteString(fmt.Sprintf("%s [%s] %s", w.ID, w.Status, w.Task))
		if last != "" {
			b.WriteString(" → " + truncate(last, 40))
		}
		b.WriteString(fmt.Sprintf(" (%d steps)\n", len(logs)))
	}
	return strings.TrimSpace(b.String()), nil
}

type Output struct{ Pool *worker.Pool }

func (t *Output) Name() string        { return "agent_output" }
func (t *Output) Description() string { return "查看子 agent 的完整输出日志" }
func (t *Output) Required() []string  { return []string{"agent_id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"},
	}
}
func (t *Output) Execute(args map[string]any) (string, error) {
	id, _ := args["agent_id"].(string)
	if id == "" {
		return "", fmt.Errorf("agent_id 是必填参数")
	}
	if t.Pool == nil {
		return "", fmt.Errorf("子 agent 系统不可用")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("子 agent %s 不存在", id)
	}
	logs := w.GetLogs()
	if len(logs) == 0 {
		return "子 agent 还没有输出", nil
	}
	var b strings.Builder
	for _, entry := range logs {
		if entry.Tool != "" {
			b.WriteString(fmt.Sprintf("[%s] %s %v\n", w.ID, entry.Tool, entry.Args))
		}
		if entry.Result != "" {
			b.WriteString(fmt.Sprintf("  → %s\n", truncate(entry.Result, 100)))
		}
		if entry.Error != "" {
			b.WriteString(fmt.Sprintf("  ⚠ %s\n", entry.Error))
		}
	}
	return strings.TrimSpace(b.String()), nil
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}
