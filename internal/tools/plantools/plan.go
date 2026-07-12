package plantools

import (
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
)

type Enter struct{}

func (t *Enter) Name() string        { return "plan_mode_enter" }
func (t *Enter) Description() string { return "进入 Plan Mode，记录计划会话状态" }
func (t *Enter) Required() []string  { return []string{} }
func (t *Enter) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"slug":   {Type: "string", Description: "可选，计划 slug"},
		"path":   {Type: "string", Description: "可选，计划文件路径"},
		"reason": {Type: "string", Description: "可选，进入 Plan Mode 的原因"},
	}
}
func (t *Enter) Execute(args map[string]any) (string, error) {
	slug, _ := args["slug"].(string)
	path, _ := args["path"].(string)
	reason, _ := args["reason"].(string)
	state := plan.Enter(slug, path, reason)
	return strings.Join(state.Lines(), "\n"), nil
}

type Exit struct{}

func (t *Exit) Name() string        { return "plan_mode_exit" }
func (t *Exit) Description() string { return "退出 Plan Mode" }
func (t *Exit) Required() []string  { return []string{} }
func (t *Exit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}
func (t *Exit) Execute(args map[string]any) (string, error) {
	plan.Exit()
	return strings.Join(plan.Status().Lines(), "\n"), nil
}

type Status struct{}

func (t *Status) Name() string        { return "plan_mode_status" }
func (t *Status) Description() string { return "查看 Plan Mode 当前状态" }
func (t *Status) Required() []string  { return []string{} }
func (t *Status) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}
func (t *Status) Execute(args map[string]any) (string, error) {
	return strings.Join(plan.Status().Lines(), "\n"), nil
}
