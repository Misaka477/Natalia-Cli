package web

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
)

var (
	SearchAPIKey  = os.Getenv("SEARCH_API_KEY")
	SearchEngine  = os.Getenv("SEARCH_ENGINE") // "google", "bing", "duckduckgo"
)

type Fetch struct{}

func (t *Fetch) Name() string        { return "web_fetch" }
func (t *Fetch) Description() string { return "获取指定 URL 的内容" }
func (t *Fetch) Required() []string  { return []string{"url"} }
func (t *Fetch) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url": {Type: "string", Description: "要获取的 URL"},
	}
}
func (t *Fetch) Execute(args map[string]any) (string, error) {
	u, _ := args["url"].(string)
	if u == "" {
		return "", fmt.Errorf("url 是必填参数")
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return "", fmt.Errorf("获取失败: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取失败: %w", err)
	}
	return string(body), nil
}

type Search struct{}

func (t *Search) Name() string        { return "web_search" }
func (t *Search) Description() string { return "搜索网络。设置 SEARCH_API_KEY 环境变量以启用" }
func (t *Search) Required() []string  { return []string{"query"} }
func (t *Search) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"query": {Type: "string", Description: "搜索关键词"},
	}
}
func (t *Search) Execute(args map[string]any) (string, error) {
	query, _ := args["query"].(string)
	if query == "" {
		return "", fmt.Errorf("query 是必填参数")
	}
	if SearchAPIKey == "" {
		return searchWithFallback(query)
	}
	return searchWithAPI(query)
}

func searchWithFallback(query string) (string, error) {
	return fmt.Sprintf("搜索: %s\n搜索结果需要配置 SEARCH_API_KEY 环境变量来启用网络搜索。目前可以使用 web_fetch 手动获取网页内容。", query), nil
}

func searchWithAPI(query string) (string, error) {
	switch SearchEngine {
	case "google":
		return searchGoogle(query)
	default:
		return searchDuckDuckGo(query)
	}
}

func searchGoogle(query string) (string, error) {
	apiURL := fmt.Sprintf("https://www.googleapis.com/customsearch/v1?key=%s&cx=%s&q=%s",
		SearchAPIKey, os.Getenv("GOOGLE_CX"), url.QueryEscape(query))
	resp, err := http.Get(apiURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	items, _ := result["items"].([]any)
	var b strings.Builder
	for _, item := range items {
		it, _ := item.(map[string]any)
		b.WriteString(fmt.Sprintf("- %s\n  %s\n", it["title"], it["link"]))
	}
	return b.String(), nil
}

func searchDuckDuckGo(query string) (string, error) {
	apiURL := fmt.Sprintf("https://api.duckduckgo.com/?q=%s&format=json&no_html=1", url.QueryEscape(query))
	resp, err := http.Get(apiURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	abstract, _ := result["Abstract"].(string)
	if abstract != "" {
		return fmt.Sprintf("%s\n来源: %s", abstract, result["AbstractURL"]), nil
	}
	results, _ := result["RelatedTopics"].([]any)
	var b strings.Builder
	for _, r := range results {
		rt, _ := r.(map[string]any)
		if text, ok := rt["Text"].(string); ok {
			b.WriteString(fmt.Sprintf("- %s\n", text))
		}
	}
	if b.Len() == 0 {
		return fmt.Sprintf("未找到 %q 的搜索结果", query), nil
	}
	return b.String(), nil
}

type MediaFile struct{}

func (t *MediaFile) Name() string        { return "read_media_file" }
func (t *MediaFile) Description() string { return "读取媒体文件信息（图片尺寸、格式等）" }
func (t *MediaFile) Required() []string  { return []string{"path"} }
func (t *MediaFile) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path": {Type: "string", Description: "媒体文件路径"},
	}
}
func (t *MediaFile) Execute(args map[string]any) (string, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return "", fmt.Errorf("path 是必填参数")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("文件不存在: %w", err)
	}
	size := info.Size()
	ext := strings.ToLower(filepathExt(path))

	result := fmt.Sprintf("文件: %s\n大小: %d bytes\n类型: %s\n", path, size, ext)

	return result, nil
}

func filepathExt(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '.' {
			return path[i:]
		}
		if path[i] == '/' || path[i] == '\\' {
			break
		}
	}
	return ""
}
