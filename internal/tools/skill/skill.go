package skills

import (
	"fmt"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/skill"
)

type List struct {
	Registry *skill.Registry
}

func (t *List) Name() string        { return "skill_list" }
func (t *List) Description() string { return "列出所有可用的技能" }
func (t *List) Required() []string  { return []string{} }
func (t *List) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}
func (t *List) Execute(args map[string]any) (string, error) {
	skills := t.Registry.List()
	if len(skills) == 0 {
		return "没有可用的技能", nil
	}
	var result string
	for _, s := range skills {
		result += fmt.Sprintf("- %s (%s): %s\n", s.Name, s.Scope, s.Description)
	}
	return result, nil
}

type Read struct {
	Registry *skill.Registry
}

func (t *Read) Name() string        { return "skill_read" }
func (t *Read) Description() string { return "读取某个技能的详细内容" }
func (t *Read) Required() []string  { return []string{"name"} }
func (t *Read) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"name": {Type: "string", Description: "技能名称"},
	}
}
func (t *Read) Execute(args map[string]any) (string, error) {
	name, _ := args["name"].(string)
	if name == "" {
		return "", fmt.Errorf("name 是必填参数")
	}
	s := t.Registry.Get(name)
	if s == nil {
		return "", fmt.Errorf("技能 %s 不存在", name)
	}
	return s.Content, nil
}
