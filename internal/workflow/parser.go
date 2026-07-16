package workflow

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

func Parse(data []byte) (*Document, error) {
	var doc Document
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse workflow document: %w", err)
	}
	if doc.OWSVersion == "" {
		return nil, fmt.Errorf("workflow document must specify 'ows' version")
	}
	if doc.Name == "" {
		return nil, fmt.Errorf("workflow document must specify 'name'")
	}
	if doc.Do == nil {
		return nil, fmt.Errorf("workflow document must contain a 'do' block")
	}
	return &doc, nil
}

func ParseFile(path string) (*Document, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read workflow file: %w", err)
	}
	return Parse(data)
}

func (c *CallAction) UnmarshalYAML(value *yaml.Node) error {
	var short string
	if err := value.Decode(&short); err == nil {
		c.Call = short
		return nil
	}
	type callActionAlias CallAction
	return value.Decode((*callActionAlias)(c))
}
