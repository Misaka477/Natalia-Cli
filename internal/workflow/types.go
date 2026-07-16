package workflow

// Document is a complete Open Workflow document.
type Document struct {
	OWSVersion string            `yaml:"ows"      json:"ows"`
	Namespace  string            `yaml:"namespace,omitempty" json:"namespace,omitempty"`
	Name       string            `yaml:"name"     json:"name"`
	Version    string            `yaml:"version,omitempty"  json:"version,omitempty"`
	Metadata   map[string]string `yaml:"metadata,omitempty" json:"metadata,omitempty"`
	Input      *TypeSchema       `yaml:"input,omitempty"    json:"input,omitempty"`
	Output     *TypeSchema       `yaml:"output,omitempty"   json:"output,omitempty"`
	Constants  map[string]any    `yaml:"constants,omitempty" json:"constants,omitempty"`
	Do         *Block            `yaml:"do"                  json:"do"`
}

type Block struct {
	Steps []Step `yaml:"steps" json:"steps"`
}

type Step struct {
	ID          string        `yaml:"id,omitempty"        json:"id,omitempty"`
	Description string        `yaml:"description,omitempty" json:"description,omitempty"`
	Do          *Block        `yaml:"do,omitempty"        json:"do,omitempty"`
	Set         *SetAction    `yaml:"set,omitempty"       json:"set,omitempty"`
	Switch      *SwitchAction `yaml:"switch,omitempty"    json:"switch,omitempty"`
	For         *ForAction    `yaml:"for,omitempty"       json:"for,omitempty"`
	Fork        []Block       `yaml:"fork,omitempty"      json:"fork,omitempty"`
	Try         *TryAction    `yaml:"try,omitempty"       json:"try,omitempty"`
	Wait        *WaitAction   `yaml:"wait,omitempty"      json:"wait,omitempty"`
	If          *IfAction     `yaml:"if,omitempty"        json:"if,omitempty"`
	Call        *CallAction   `yaml:"call,omitempty"      json:"call,omitempty"`
	Export      *ExportAction `yaml:"export,omitempty"    json:"export,omitempty"`
	Timeout     string        `yaml:"timeout,omitempty"   json:"timeout,omitempty"`
	Retry       *RetryPolicy  `yaml:"retry,omitempty"     json:"retry,omitempty"`
}

type SetAction struct {
	Target string `yaml:"target" json:"target"`
	Value  any    `yaml:"value"  json:"value"`
}

type SwitchAction struct {
	Expression string       `yaml:"expression" json:"expression"`
	Cases      []SwitchCase `yaml:"cases"      json:"cases"`
	Default    *Block       `yaml:"default,omitempty" json:"default,omitempty"`
}

type SwitchCase struct {
	Match any    `yaml:"match" json:"match"`
	Do    *Block `yaml:"do"    json:"do"`
}

type ForAction struct {
	Each     string `yaml:"each,omitempty"  json:"each,omitempty"`
	In       string `yaml:"in,omitempty"    json:"in,omitempty"`
	While    string `yaml:"while,omitempty" json:"while,omitempty"`
	Do       *Block `yaml:"do"              json:"do"`
	MaxLoops int    `yaml:"max-loops,omitempty" json:"max-loops,omitempty"`
}

type TryAction struct {
	Try   *Block      `yaml:"try"           json:"try"`
	Catch []CatchCase `yaml:"catch,omitempty" json:"catch,omitempty"`
}

type CatchCase struct {
	Errors []string `yaml:"errors" json:"errors"`
	Do     *Block   `yaml:"do"     json:"do"`
}

type WaitAction struct {
	Duration string `yaml:"duration" json:"duration"`
}

type IfAction struct {
	Expression string `yaml:"expression" json:"expression"`
	Then       *Block `yaml:"then"       json:"then"`
	Else       *Block `yaml:"else,omitempty" json:"else,omitempty"`
}

type CallAction struct {
	Call string         `yaml:"call" json:"call"`
	With map[string]any `yaml:"with,omitempty" json:"with,omitempty"`
}

type ExportAction struct {
	Target string `yaml:"target" json:"target"`
	Value  string `yaml:"value"  json:"value"`
}

type RetryPolicy struct {
	MaxAttempts int    `yaml:"max-attempts,omitempty" json:"max-attempts,omitempty"`
	InitialWait string `yaml:"initial-wait,omitempty" json:"initial-wait,omitempty"`
	MaxWait     string `yaml:"max-wait,omitempty"     json:"max-wait,omitempty"`
}

type TypeSchema struct {
	Type       string                `yaml:"type,omitempty" json:"type,omitempty"`
	Properties map[string]TypeSchema `yaml:"properties,omitempty" json:"properties,omitempty"`
	Required   []string              `yaml:"required,omitempty"  json:"required,omitempty"`
	Items      *TypeSchema           `yaml:"items,omitempty"     json:"items,omitempty"`
}
