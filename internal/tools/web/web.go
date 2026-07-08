package web

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
)

type Fetch struct{}

func (t *Fetch) Name() string        { return "web_fetch" }
func (t *Fetch) Description() string { return "获取 URL 内容" }
func (t *Fetch) Required() []string  { return []string{"url"} }
func (t *Fetch) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url": {Type: "string", Description: "要获取的 URL"},
	}
}
func (t *Fetch) Execute(args map[string]any) (string, error) {
	url, _ := args["url"].(string)
	if url == "" {
		return "", fmt.Errorf("url required")
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	return string(body), nil
}

type Search struct{}

func (t *Search) Name() string        { return "web_search" }
func (t *Search) Description() string { return "搜索网络（占位，需配置搜索 API）" }
func (t *Search) Required() []string  { return []string{"query"} }
func (t *Search) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"query": {Type: "string", Description: "搜索关键词"},
	}
}
func (t *Search) Execute(args map[string]any) (string, error) {
	query, _ := args["query"].(string)
	if query == "" {
		return "", fmt.Errorf("query required")
	}
	return fmt.Sprintf("搜索占位：%s（需配置搜索 API）", query), nil
}

type ListDir struct{}

func (t *ListDir) Name() string        { return "list_dir" }
func (t *ListDir) Description() string { return "列出目录内容" }
func (t *ListDir) Required() []string  { return []string{"path"} }
func (t *ListDir) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path": {Type: "string", Description: "目录路径"},
	}
}
func (t *ListDir) Execute(args map[string]any) (string, error) {
	return "unimplemented", fmt.Errorf("use run_shell ls instead")
}
