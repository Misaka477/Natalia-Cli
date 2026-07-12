package ask_user

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
)

type AskUser struct{}

func (t *AskUser) Name() string        { return "ask_user" }
func (t *AskUser) Description() string { return "向用户提问以获取更多信息" }
func (t *AskUser) Required() []string  { return []string{"question"} }
func (t *AskUser) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"question": {Type: "string", Description: "要问用户的问题"},
	}
}
func (t *AskUser) Execute(args map[string]any) (string, error) {
	question, _ := args["question"].(string)
	if question == "" {
		return "", fmt.Errorf("question 是必填参数")
	}

	fmt.Fprintf(os.Stderr, "\n[提问] %s\n> ", question)
	reader := bufio.NewReader(os.Stdin)
	answer, _ := reader.ReadString('\n')
	return strings.TrimSpace(answer), nil
}
