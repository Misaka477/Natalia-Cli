package plantools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/filepolicy"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
)

type Enter struct {
	Manager *plan.Manager
}

func (t *Enter) Name() string { return "plan_mode_enter" }
func (t *Enter) Description() string {
	return "进入 Plan Mode，记录计划会话状态；path 必须位于当前 workspace 的 plans/.natalia/plans/.kilo/plans 目录内，create_template=true 会在允许路径创建模板"
}
func (t *Enter) Required() []string { return []string{} }
func (t *Enter) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"slug":            {Type: "string", Description: "可选，计划 slug"},
		"path":            {Type: "string", Description: "可选，计划文件路径；必须位于当前 workspace 的 plans/.natalia/plans/.kilo/plans 目录内，输出会显示 resolved path"},
		"reason":          {Type: "string", Description: "可选，进入 Plan Mode 的原因"},
		"create_template": {Type: "boolean", Description: "可选，路径不存在时是否创建模板文件；默认 false"},
	}
}
func (t *Enter) Execute(args map[string]any) (string, error) {
	slug, _ := args["slug"].(string)
	path, _ := args["path"].(string)
	reason, _ := args["reason"].(string)
	createTemplate := false
	if v, ok := args["create_template"].(bool); ok {
		createTemplate = v
	}

	manager := managerOrDefault(t.Manager)

	if strings.TrimSpace(path) != "" {
		resolved, err := resolvePlanPath(path)
		if err != nil {
			return "", err
		}
		path = resolved
		if createTemplate {
			if _, err := os.Stat(path); os.IsNotExist(err) {
				dir := filepath.Dir(path)
				if err := os.MkdirAll(dir, 0755); err != nil {
					return "", fmt.Errorf("failed to create plan directory %s: %w", dir, err)
				}
				template := "# Plan\n\n- [ ] TODO\n"
				if err := os.WriteFile(path, []byte(template), 0644); err != nil {
					return "", fmt.Errorf("failed to create plan template %s: %w", path, err)
				}
			} else if err != nil {
				return "", fmt.Errorf("failed to inspect plan path %s: %w", path, err)
			}
		}
	}

	state := manager.Enter(slug, path, reason)
	return strings.Join(state.Lines(), "\n"), nil
}

func resolvePlanPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("plan path required")
	}
	clean, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	clean = filepath.Clean(clean)
	if resolved, err := filepath.EvalSymlinks(clean); err == nil {
		clean = filepath.Clean(resolved)
	} else if parent, err := filepath.EvalSymlinks(filepath.Dir(clean)); err == nil {
		clean = filepath.Join(parent, filepath.Base(clean))
	}
	if !plan.IsPlanPath(clean) {
		return "", fmt.Errorf("plan path must be inside a plans directory in the workspace: %s", clean)
	}
	if err := filepolicy.New("", nil).GuardWrite(clean); err != nil {
		return "", fmt.Errorf("plan path rejected by workspace policy: %w", err)
	}
	return clean, nil
}

type Exit struct {
	Manager *plan.Manager
}

func (t *Exit) Name() string        { return "plan_mode_exit" }
func (t *Exit) Description() string { return "退出 Plan Mode" }
func (t *Exit) Required() []string  { return []string{} }
func (t *Exit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}
func (t *Exit) Execute(args map[string]any) (string, error) {
	manager := managerOrDefault(t.Manager)
	manager.Exit()
	return strings.Join(manager.Status().Lines(), "\n"), nil
}

type Status struct {
	Manager *plan.Manager
}

func (t *Status) Name() string        { return "plan_mode_status" }
func (t *Status) Description() string { return "查看 Plan Mode 当前状态" }
func (t *Status) Required() []string  { return []string{} }
func (t *Status) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}
func (t *Status) Execute(args map[string]any) (string, error) {
	manager := managerOrDefault(t.Manager)
	state := manager.Status()
	lines := state.Lines()

	if state.Enabled && state.Path != "" {
		info, err := os.Stat(state.Path)
		if err == nil {
			lines = append(lines, fmt.Sprintf("plan_exists: yes"))
			lines = append(lines, fmt.Sprintf("plan_mtime: %s", info.ModTime().Format(time.RFC3339)))

			data, err := os.ReadFile(state.Path)
			if err == nil {
				total, done := countChecklistItems(string(data))
				if total > 0 {
					lines = append(lines, fmt.Sprintf("checklist: %d/%d done", done, total))
				}
				if next := nextOpenStepText(string(data)); next != "" {
					lines = append(lines, fmt.Sprintf("next_step: %s", next))
				}
			}
		} else if os.IsNotExist(err) {
			lines = append(lines, "plan_exists: no")
		}
	}

	return strings.Join(lines, "\n"), nil
}

func managerOrDefault(manager *plan.Manager) *plan.Manager {
	if manager != nil {
		return manager
	}
	return plan.Default()
}

func countChecklistItems(content string) (total, done int) {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "- [ ] ") {
			total++
		} else if strings.HasPrefix(trimmed, "- [x] ") || strings.HasPrefix(trimmed, "- [X] ") {
			total++
			done++
		}
	}
	return total, done
}

func nextOpenStepText(content string) string {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "- [ ] ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "- [ ] "))
		}
	}
	return ""
}
