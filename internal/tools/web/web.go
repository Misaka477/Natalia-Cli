package web

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
)

var (
	SearchAPIKey  = os.Getenv("SEARCH_API_KEY")
	SearchEngine  = os.Getenv("SEARCH_ENGINE")
	SearchBaseURL = os.Getenv("SEARCH_BASE_URL")
)

type SearchResult struct {
	Title   string
	URL     string
	Snippet string
	Content string
	Date    string
	Source  string
}

type Search struct{}

func (t *Search) Name() string { return "web_search" }
func (t *Search) Description() string {
	return "搜索网络，返回相关结果列表。支持设置 SEARCH_API_KEY 和 SEARCH_ENGINE 环境变量来配置搜索引擎"
}
func (t *Search) Required() []string { return []string{"query"} }
func (t *Search) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"query":           {Type: "string", Description: "搜索关键词"},
		"limit":           {Type: "string", Description: "可选，返回结果数量，默认 5"},
		"include_content": {Type: "string", Description: "可选，设为 true 时同时抓取页面内容（消耗更多 token）"},
	}
}
func (t *Search) Execute(args map[string]any) (string, error) {
	query, _ := args["query"].(string)
	if query == "" {
		return "", fmt.Errorf("query 是必填参数")
	}

	limit := 5
	if l, ok := args["limit"].(string); ok {
		parsed, err := strconv.Atoi(strings.TrimSpace(l))
		if err != nil {
			return "", fmt.Errorf("limit must be an integer")
		}
		limit = parsed
	}
	if limit < 1 || limit > 20 {
		limit = 5
	}

	includeContent, _ := args["include_content"].(string)

	var results []SearchResult
	var err error

	if SearchBaseURL != "" {
		results, err = searchCustom(query, limit, includeContent == "true")
	} else if SearchAPIKey != "" && SearchEngine == "google" {
		results, err = searchGoogle(query, limit)
	} else {
		results, err = searchDuckDuckGo(query, limit)
	}

	if err != nil {
		return "", fmt.Errorf("搜索失败: %w", err)
	}
	if len(results) == 0 {
		return fmt.Sprintf("未找到 %q 的相关结果", query), nil
	}

	var b strings.Builder
	for i, r := range results {
		if i > 0 {
			b.WriteString("---\n")
		}
		b.WriteString(fmt.Sprintf("标题: %s\n", r.Title))
		if r.Date != "" {
			b.WriteString(fmt.Sprintf("日期: %s\n", r.Date))
		}
		b.WriteString(fmt.Sprintf("网址: %s\n", r.URL))
		b.WriteString(fmt.Sprintf("摘要: %s\n", r.Snippet))
		if r.Content != "" {
			b.WriteString(fmt.Sprintf("\n%s\n", r.Content))
		}
	}
	return b.String(), nil
}

func searchCustom(query string, limit int, includeContent bool) ([]SearchResult, error) {
	body := map[string]any{
		"text_query":           query,
		"limit":                limit,
		"enable_page_crawling": includeContent,
	}

	data, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", SearchBaseURL, strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	if SearchAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+SearchAPIKey)
	}

	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("search API returned status %d", resp.StatusCode)
	}

	var apiResp struct {
		SearchResults []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Snippet string `json:"snippet"`
			Content string `json:"content,omitempty"`
			Date    string `json:"date,omitempty"`
		} `json:"search_results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(apiResp.SearchResults))
	for _, r := range apiResp.SearchResults {
		results = append(results, SearchResult{
			Title: r.Title, URL: r.URL, Snippet: r.Snippet,
			Content: r.Content, Date: r.Date,
		})
	}
	return results, nil
}

func searchGoogle(query string, limit int) ([]SearchResult, error) {
	cx := os.Getenv("GOOGLE_CX")
	values := url.Values{}
	values.Set("key", SearchAPIKey)
	values.Set("cx", cx)
	values.Set("q", query)
	values.Set("num", strconv.Itoa(limit))
	req, err := http.NewRequest("GET", "https://www.googleapis.com/customsearch/v1?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Items []struct {
			Title   string `json:"title"`
			Link    string `json:"link"`
			Snippet string `json:"snippet"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(result.Items))
	for _, item := range result.Items {
		results = append(results, SearchResult{
			Title: item.Title, URL: item.Link, Snippet: item.Snippet,
		})
	}
	return results, nil
}

func searchDuckDuckGo(query string, limit int) ([]SearchResult, error) {
	// Try instant answer API first (faster, no key needed)
	apiURL := fmt.Sprintf("https://api.duckduckgo.com/?q=%s&format=json&no_html=1&skip_disambig=1",
		url.QueryEscape(query))
	resp, err := http.Get(apiURL)
	if err == nil {
		defer resp.Body.Close()
		var ddg struct {
			Abstract      string `json:"Abstract"`
			AbstractURL   string `json:"AbstractURL"`
			RelatedTopics []any  `json:"RelatedTopics"`
		}
		json.NewDecoder(resp.Body).Decode(&ddg)

		var results []SearchResult
		if ddg.Abstract != "" {
			results = append(results, SearchResult{
				Title: "摘要", URL: ddg.AbstractURL,
				Snippet: ddg.Abstract,
			})
		}
		for _, rt := range ddg.RelatedTopics {
			if len(results) >= limit {
				break
			}
			switch v := rt.(type) {
			case map[string]any:
				if text, ok := v["Text"].(string); ok {
					results = append(results, SearchResult{
						Title: truncate(text, 60), Snippet: text,
					})
				}
			}
		}
		if len(results) > 0 {
			return results, nil
		}
	}

	// Fallback: scrape HTML search results
	return searchDuckDuckGoHTML(query, limit)
}

func searchDuckDuckGoHTML(query string, limit int) ([]SearchResult, error) {
	url := fmt.Sprintf("https://html.duckduckgo.com/html/?q=%s", url.QueryEscape(query))
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "text/html")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	html := string(body)

	var results []SearchResult

	// Simple extraction: find result links
	for i := 0; i < len(html); {
		idx := strings.Index(html[i:], `class="result__a"`)
		if idx < 0 {
			break
		}
		i += idx
		titleStart := strings.Index(html[i:], ">")
		if titleStart < 0 {
			break
		}
		titleStart += i + 1
		titleEnd := strings.Index(html[titleStart:], "</a>")
		if titleEnd < 0 {
			break
		}
		title := stripTags(html[titleStart : titleStart+titleEnd])
		i = titleStart + titleEnd

		snippet := ""
		si := strings.Index(html[i:], `class="result__snippet"`)
		if si >= 0 {
			s := i + si
			snipStart := strings.Index(html[s:], ">")
			if snipStart >= 0 {
				snipStart += s + 1
				snipEnd := strings.Index(html[snipStart:], "</a>")
				if snipEnd < 0 {
					snipEnd = strings.Index(html[snipStart:], "</span>")
				}
				if snipEnd >= 0 {
					snippet = stripTags(html[snipStart : snipStart+snipEnd])
				}
			}
		}

		results = append(results, SearchResult{
			Title:   strings.TrimSpace(title),
			Snippet: strings.TrimSpace(snippet),
		})
		if len(results) >= limit {
			break
		}
	}

	if len(results) == 0 {
		return nil, nil
	}
	return results, nil
}

func stripTags(s string) string {
	var b strings.Builder
	inTag := false
	for _, r := range s {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			b.WriteRune(r)
		}
	}
	return b.String()
}

type Fetch struct{}

func (t *Fetch) Name() string        { return "web_fetch" }
func (t *Fetch) Description() string { return "获取指定 URL 的网页内容，提取正文文本" }
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

	client := &http.Client{Timeout: 60 * time.Second}
	req, _ := http.NewRequest("GET", u, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("获取失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("HTTP %d: 页面无法访问", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取失败: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "text/plain") || strings.Contains(contentType, "text/markdown") {
		return string(body), nil
	}

	text := stripHTML(string(body))
	if text == "" {
		return "无法从页面提取到有效内容（页面可能需要 JavaScript 渲染）", nil
	}
	return text, nil
}

func stripHTML(html string) string {
	var b strings.Builder
	inTag := false
	inScript := false
	for i := 0; i < len(html); i++ {
		if inScript {
			if i+8 < len(html) && strings.ToLower(html[i:i+9]) == "</script>" {
				inScript = false
				i += 8
			}
			continue
		}
		if i+6 < len(html) && strings.ToLower(html[i:i+7]) == "<script" {
			inScript = true
			continue
		}
		if html[i] == '<' {
			inTag = true
			continue
		}
		if html[i] == '>' {
			inTag = false
			continue
		}
		if !inTag {
			b.WriteByte(html[i])
		}
	}

	result := strings.TrimSpace(b.String())
	lines := strings.Split(result, "\n")
	var clean []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	if len(clean) > 200 {
		clean = clean[:200]
	}
	return strings.Join(clean, "\n")
}

type MediaFile struct{}

func (t *MediaFile) Name() string { return "read_media_file" }
func (t *MediaFile) Description() string {
	return "读取媒体文件信息（图片尺寸、格式、大小等）"
}
func (t *MediaFile) Required() []string { return []string{"path"} }
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
	ext := ""
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '.' {
			ext = path[i:]
			break
		}
		if path[i] == '/' || path[i] == '\\' {
			break
		}
	}
	return fmt.Sprintf("文件: %s\n大小: %d bytes\n类型: %s\n", path, info.Size(), ext), nil
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}
