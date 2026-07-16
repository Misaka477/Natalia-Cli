package skill

type SkillFrontmatter struct {
	Name          string            `yaml:"name"`
	Description   string            `yaml:"description"`
	License       string            `yaml:"license,omitempty"`
	Compatibility map[string]string `yaml:"compatibility,omitempty"`
	Metadata      map[string]string `yaml:"metadata,omitempty"`
	AllowedTools  []string          `yaml:"allowed-tools,omitempty"`

	// Claude Code extensions
	Invocation *ClaudeInvocation `yaml:"invocation,omitempty"`
	ToolPolicy *ToolPolicy       `yaml:"tool-policy,omitempty"`
	Paths      []string          `yaml:"paths,omitempty"`
	Model      string            `yaml:"model,omitempty"`
	Effort     string            `yaml:"effort,omitempty"`
	Context    *ClaudeContext    `yaml:"context,omitempty"`

	// Codex/OpenAI extensions
	CodexMetadata *CodexMetadata `yaml:"openai,omitempty"`
}

type ClaudeInvocation struct {
	Type   string `yaml:"type"`
	Macro  string `yaml:"macro,omitempty"`
	Prompt string `yaml:"prompt,omitempty"`
}

type ToolPolicy map[string]ToolPolicyRule

type ToolPolicyRule struct {
	RequireApproval bool     `yaml:"require-approval,omitempty"`
	Allowed         []string `yaml:"allowed,omitempty"`
	Denied          []string `yaml:"denied,omitempty"`
	MaxCalls        int      `yaml:"max-calls,omitempty"`
}

type ClaudeContext struct {
	Fork      bool     `yaml:"fork,omitempty"`
	Agent     string   `yaml:"agent,omitempty"`
	SubAgents []string `yaml:"sub-agents,omitempty"`
}

type CodexMetadata struct {
	Title       string `yaml:"title,omitempty"`
	Group       string `yaml:"group,omitempty"`
	Icon        string `yaml:"icon,omitempty"`
	Prompt      string `yaml:"prompt,omitempty"`
	Description string `yaml:"description,omitempty"`
}
