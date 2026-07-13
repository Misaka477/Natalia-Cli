package web

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"html"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/networkpolicy"
)

var (
	SearchAPIKey           = os.Getenv("SEARCH_API_KEY")
	SearchEngine           = os.Getenv("SEARCH_ENGINE")
	SearchProviderPriority = os.Getenv("SEARCH_PROVIDER_PRIORITY")
	SearchBaseURL          = os.Getenv("SEARCH_BASE_URL")
	BingSearchBaseURL      = "https://www.bing.com/search"
	DDGAPIBaseURL          = "https://api.duckduckgo.com/"
	DDGHTMLBaseURL         = "https://html.duckduckgo.com/html/"
	NetworkPolicy          = networkpolicy.Default()
	webSearchHTTPClient    = NetworkPolicy.HTTPClient(15 * time.Second)
)

func ConfigureNetworkPolicy(policy *networkpolicy.Policy) {
	if policy == nil {
		policy = networkpolicy.Default()
	}
	NetworkPolicy = policy
	webSearchHTTPClient = policy.HTTPClient(15 * time.Second)
}

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
	return "搜索网络，返回相关结果列表。支持 SEARCH_PROVIDER_PRIORITY 配置 provider 顺序，默认 bing -> google -> duckduckgo"
}
func (t *Search) Required() []string { return []string{"query"} }
func (t *Search) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"query":             {Type: "string", Description: "搜索关键词"},
		"limit":             {Type: "string", Description: "可选，返回结果数量，默认 5"},
		"include_content":   {Type: "string", Description: "可选，设为 true 时同时抓取页面内容（消耗更多 token）"},
		"provider_priority": {Type: "string", Description: "可选，搜索 provider 顺序，如 bing,google,duckduckgo"},
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

	includeContent := parseBoolArg(args, "include_content")

	var results []SearchResult
	var err error
	var diagnostics []string

	if SearchBaseURL != "" {
		results, err = searchCustom(query, limit, includeContent)
	} else if SearchEngine != "" {
		results, diagnostics, err = searchByPriority(query, limit, []string{SearchEngine})
	} else {
		results, diagnostics, err = searchByPriority(query, limit, effectiveSearchProviderPriority(args))
	}

	if err != nil {
		return "", fmt.Errorf("搜索失败: %w", err)
	}
	if len(results) == 0 {
		msg := fmt.Sprintf("未找到 %q 的相关结果", query)
		if len(diagnostics) > 0 {
			msg += "\n搜索诊断:\n- " + strings.Join(diagnostics, "\n- ")
		}
		return msg, nil
	}

	var b strings.Builder
	if len(diagnostics) > 0 {
		b.WriteString("搜索诊断:\n- ")
		b.WriteString(strings.Join(diagnostics, "\n- "))
		b.WriteString("\n\n")
	}
	for i, r := range results {
		if i > 0 {
			b.WriteString("---\n")
		}
		b.WriteString(fmt.Sprintf("标题: %s\n", r.Title))
		if r.Date != "" {
			b.WriteString(fmt.Sprintf("日期: %s\n", r.Date))
		}
		if r.Source != "" {
			b.WriteString(fmt.Sprintf("来源: %s\n", r.Source))
		}
		b.WriteString(fmt.Sprintf("网址: %s\n", r.URL))
		b.WriteString(fmt.Sprintf("摘要: %s\n", r.Snippet))
		if r.Content != "" {
			b.WriteString(fmt.Sprintf("\n%s\n", r.Content))
		}
	}
	return b.String(), nil
}

func searchDefault(query string, limit int) ([]SearchResult, error) {
	results, _, err := searchByPriority(query, limit, defaultSearchProviderPriority())
	return results, err

}

func searchByPriority(query string, limit int, providers []string) ([]SearchResult, []string, error) {
	if len(providers) == 0 {
		providers = defaultSearchProviderPriority()
	}
	diagnostics := make([]string, 0, len(providers))
	for _, provider := range providers {
		provider = normalizeSearchProvider(provider)
		if provider == "" {
			continue
		}
		results, err := searchByProvider(provider, query, limit)
		if err != nil {
			diagnostics = append(diagnostics, fmt.Sprintf("%s: %s", provider, sanitizeSearchDiagnostic(err)))
			continue
		}
		if len(results) == 0 {
			diagnostics = append(diagnostics, fmt.Sprintf("%s: no results", provider))
			continue
		}
		return results, diagnostics, nil
	}
	return nil, diagnostics, nil
}

func searchByProvider(provider, query string, limit int) ([]SearchResult, error) {
	switch provider {
	case "bing":
		return searchBingHTML(query, limit)
	case "google":
		return searchGoogle(query, limit)
	case "duckduckgo", "ddg":
		return searchDuckDuckGo(query, limit)
	default:
		return nil, fmt.Errorf("unsupported provider %q", provider)
	}
}

func effectiveSearchProviderPriority(args map[string]any) []string {
	if raw, ok := args["provider_priority"].(string); ok && strings.TrimSpace(raw) != "" {
		return splitSearchProviders(raw)
	}
	if strings.TrimSpace(SearchProviderPriority) != "" {
		return splitSearchProviders(SearchProviderPriority)
	}
	return defaultSearchProviderPriority()
}

func defaultSearchProviderPriority() []string {
	return []string{"bing", "google", "duckduckgo"}
}

func splitSearchProviders(raw string) []string {
	fields := strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == '>' || r == ' ' || r == '\t' || r == '\n' })
	providers := make([]string, 0, len(fields))
	seen := make(map[string]bool)
	for _, field := range fields {
		provider := normalizeSearchProvider(field)
		if provider == "" || seen[provider] {
			continue
		}
		seen[provider] = true
		providers = append(providers, provider)
	}
	return providers
}

func normalizeSearchProvider(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "", "none":
		return ""
	case "ddg", "duckduckgo", "duck-duck-go":
		return "duckduckgo"
	default:
		return strings.ToLower(strings.TrimSpace(provider))
	}
}

func sanitizeSearchDiagnostic(err error) string {
	msg := err.Error()
	if SearchAPIKey != "" {
		msg = strings.ReplaceAll(msg, SearchAPIKey, "[redacted]")
	}
	return msg
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

	client := NetworkPolicy.HTTPClient(180 * time.Second)
	if err := NetworkPolicy.ValidateURL(req.Context(), SearchBaseURL); err != nil {
		return nil, err
	}
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
	if SearchAPIKey == "" {
		return nil, fmt.Errorf("missing SEARCH_API_KEY")
	}
	cx := os.Getenv("GOOGLE_CX")
	if cx == "" {
		return nil, fmt.Errorf("missing GOOGLE_CX")
	}
	values := url.Values{}
	values.Set("key", SearchAPIKey)
	values.Set("cx", cx)
	values.Set("q", query)
	values.Set("num", strconv.Itoa(limit))
	req, err := http.NewRequest("GET", "https://www.googleapis.com/customsearch/v1?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := webSearchHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("google search returned 429 rate limited")
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google search returned status %d", resp.StatusCode)
	}

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
			Title: item.Title, URL: item.Link, Snippet: item.Snippet, Source: "google",
		})
	}
	return results, nil
}

func searchDuckDuckGo(query string, limit int) ([]SearchResult, error) {
	// Try instant answer API first (faster, no key needed)
	apiURL := fmt.Sprintf("%s?q=%s&format=json&no_html=1&skip_disambig=1",
		strings.TrimRight(DDGAPIBaseURL, "/"), url.QueryEscape(query))
	req, _ := http.NewRequest("GET", apiURL, nil)
	resp, err := webSearchHTTPClient.Do(req)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, fmt.Errorf("duckduckgo search returned 429 rate limited")
		}
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
				Snippet: ddg.Abstract, Source: "duckduckgo",
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
						Title: truncate(text, 60), Snippet: text, Source: "duckduckgo",
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
	searchURL := fmt.Sprintf("%s?q=%s", strings.TrimRight(DDGHTMLBaseURL, "/"), url.QueryEscape(query))
	req, _ := http.NewRequest("GET", searchURL, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "text/html")

	resp, err := webSearchHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("duckduckgo html search returned 429 rate limited")
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("duckduckgo html search returned status %d", resp.StatusCode)
	}

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
			Source:  "duckduckgo",
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

func searchBingHTML(query string, limit int) ([]SearchResult, error) {
	searchURL := fmt.Sprintf("%s?q=%s", strings.TrimRight(BingSearchBaseURL, "/"), url.QueryEscape(query))
	req, _ := http.NewRequest("GET", searchURL, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "text/html")

	resp, err := webSearchHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("bing search returned 429 rate limited")
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("bing search returned status %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	return parseBingHTML(string(body), limit), nil
}

func parseBingHTML(page string, limit int) []SearchResult {
	results := make([]SearchResult, 0)
	for i := 0; i < len(page) && len(results) < limit; {
		idx := strings.Index(page[i:], `class="b_algo"`)
		if idx < 0 {
			idx = strings.Index(page[i:], `class='b_algo'`)
		}
		if idx < 0 {
			break
		}
		i += idx
		blockEnd := strings.Index(page[i:], "</li>")
		if blockEnd < 0 {
			break
		}
		block := page[i : i+blockEnd]
		title, href := extractFirstAnchor(block)
		if title == "" || href == "" {
			i += blockEnd + len("</li>")
			continue
		}
		snippet := extractClassText(block, "b_caption")
		if snippet == "" {
			snippet = extractClassText(block, "b_snippet")
		}
		results = append(results, SearchResult{Title: title, URL: href, Snippet: snippet, Source: "bing"})
		i += blockEnd + len("</li>")
	}
	return results
}

func extractFirstAnchor(block string) (string, string) {
	hrefIdx := strings.Index(block, `href="`)
	quote := `"`
	if hrefIdx < 0 {
		hrefIdx = strings.Index(block, `href='`)
		quote = `'`
	}
	if hrefIdx < 0 {
		return "", ""
	}
	hrefStart := hrefIdx + len(`href=`) + 1
	hrefEnd := strings.Index(block[hrefStart:], quote)
	if hrefEnd < 0 {
		return "", ""
	}
	href := block[hrefStart : hrefStart+hrefEnd]
	textStart := strings.Index(block[hrefStart+hrefEnd:], ">")
	if textStart < 0 {
		return "", ""
	}
	textStart += hrefStart + hrefEnd + 1
	textEnd := strings.Index(block[textStart:], "</a>")
	if textEnd < 0 {
		return "", ""
	}
	return strings.TrimSpace(html.UnescapeString(stripTags(block[textStart : textStart+textEnd]))), strings.TrimSpace(html.UnescapeString(href))
}

func extractClassText(block, className string) string {
	idx := strings.Index(block, className)
	if idx < 0 {
		return ""
	}
	start := strings.Index(block[idx:], ">")
	if start < 0 {
		return ""
	}
	start += idx + 1
	end := strings.Index(block[start:], "</")
	if end < 0 {
		return ""
	}
	return strings.TrimSpace(html.UnescapeString(stripTags(block[start : start+end])))
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
		"url":           {Type: "string", Description: "要获取的 URL"},
		"format":        {Type: "string", Description: "可选，text|markdown|html，默认 text"},
		"timeout":       {Type: "string", Description: "可选，超时秒数，默认 60，范围 1-120"},
		"max_bytes":     {Type: "string", Description: "可选，最多读取响应字节数，默认 1048576，最大 5242880"},
		"include_links": {Type: "string", Description: "可选，设为 true 时在 text/markdown 输出中包含页面链接引用"},
	}
}
func (t *Fetch) Execute(args map[string]any) (string, error) {
	u, _ := args["url"].(string)
	if u == "" {
		return "", fmt.Errorf("url 是必填参数")
	}
	format, err := parseFetchFormat(args)
	if err != nil {
		return "", err
	}
	includeLinks := parseBoolArg(args, "include_links")
	timeout, err := parseStringIntArg(args, "timeout", 60, 1, 120)
	if err != nil {
		return "", err
	}
	maxBytes, err := parseStringIntArg(args, "max_bytes", 1024*1024, 1, 5*1024*1024)
	if err != nil {
		return "", err
	}

	client := NetworkPolicy.HTTPClient(time.Duration(timeout) * time.Second)
	req, _ := http.NewRequest("GET", u, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	if err := NetworkPolicy.ValidateURL(req.Context(), u); err != nil {
		return "", fmt.Errorf("获取失败: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("获取失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("HTTP %d: 页面无法访问", resp.StatusCode)
	}

	bodyReader, err := decodedResponseBody(resp)
	if err != nil {
		return "", fmt.Errorf("解码响应失败: %w", err)
	}
	body, truncated, err := readLimited(bodyReader, maxBytes)
	if err != nil {
		return "", fmt.Errorf("读取失败: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	if isBinaryResponse(contentType, body) {
		return fmt.Sprintf("Binary response not included. URL: %s\nContent-Type: %s\nRead: %d bytes\nTruncated: %t", u, contentType, len(body), truncated), nil
	}
	bodyText, err := decodeTextBody(body, contentType)
	if err != nil {
		return "", fmt.Errorf("字符集解码失败: %w", err)
	}
	if format == "html" {
		return appendTruncationMarker(bodyText, truncated, maxBytes), nil
	}
	if strings.Contains(contentType, "text/plain") || strings.Contains(contentType, "text/markdown") {
		return appendTruncationMarker(bodyText, truncated, maxBytes), nil
	}

	text, err := renderHTMLBody(bodyText, u, format, includeLinks)
	if err != nil {
		return "", fmt.Errorf("HTML 解析失败: %w", err)
	}
	if text == "" {
		return "无法从页面提取到有效内容（页面可能需要 JavaScript 渲染）", nil
	}
	return appendTruncationMarker(text, truncated, maxBytes), nil
}

func parseFetchFormat(args map[string]any) (string, error) {
	format, _ := args["format"].(string)
	if format == "" {
		return "text", nil
	}
	switch format {
	case "text", "markdown", "html":
		return format, nil
	default:
		return "", fmt.Errorf("format must be one of text, markdown, html")
	}
}

func parseStringIntArg(args map[string]any, name string, defaultValue, minValue, maxValue int) (int, error) {
	raw, ok := args[name]
	if !ok || raw == nil {
		return defaultValue, nil
	}
	var value int
	switch v := raw.(type) {
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil {
			return 0, fmt.Errorf("%s must be an integer", name)
		}
		value = parsed
	case float64:
		if v != float64(int(v)) {
			return 0, fmt.Errorf("%s must be an integer", name)
		}
		value = int(v)
	case int:
		value = v
	default:
		return 0, fmt.Errorf("%s must be an integer", name)
	}
	if value < minValue || value > maxValue {
		return 0, fmt.Errorf("%s must be between %d and %d", name, minValue, maxValue)
	}
	return value, nil
}

func readLimited(r io.Reader, maxBytes int) ([]byte, bool, error) {
	data, err := io.ReadAll(io.LimitReader(r, int64(maxBytes)+1))
	if err != nil {
		return nil, false, err
	}
	if len(data) > maxBytes {
		return data[:maxBytes], true, nil
	}
	return data, false, nil
}

func decodedResponseBody(resp *http.Response) (io.Reader, error) {
	if strings.EqualFold(resp.Header.Get("Content-Encoding"), "gzip") {
		return gzip.NewReader(resp.Body)
	}
	return resp.Body, nil
}

func parseBoolArg(args map[string]any, name string) bool {
	raw, ok := args[name]
	if !ok || raw == nil {
		return false
	}
	switch v := raw.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(strings.TrimSpace(v), "true") || strings.TrimSpace(v) == "1" || strings.EqualFold(strings.TrimSpace(v), "yes")
	default:
		return false
	}
}

func isBinaryResponse(contentType string, body []byte) bool {
	lower := strings.ToLower(contentType)
	if strings.Contains(lower, "text/") || strings.Contains(lower, "html") || strings.Contains(lower, "json") || strings.Contains(lower, "xml") || strings.Contains(lower, "markdown") {
		return false
	}
	return strings.ContainsRune(string(body), '\x00') || lower != ""
}

func appendTruncationMarker(text string, truncated bool, maxBytes int) string {
	if !truncated {
		return text
	}
	return text + fmt.Sprintf("\n[response truncated at %d bytes]", maxBytes)
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
	return executeFileInfo(args)
}

type FileInfo struct{}

func (t *FileInfo) Name() string { return "file_info" }
func (t *FileInfo) Description() string {
	return "读取文件信息（大小、MIME、图片尺寸、基础 EXIF metadata 等），read_media_file 的新名称"
}
func (t *FileInfo) Required() []string { return []string{"path"} }
func (t *FileInfo) Parameters() map[string]llm.Property {
	return (&MediaFile{}).Parameters()
}
func (t *FileInfo) Execute(args map[string]any) (string, error) {
	return executeFileInfo(args)
}

func executeFileInfo(args map[string]any) (string, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return "", fmt.Errorf("path 是必填参数")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("文件不存在: %w", err)
	}
	if info.IsDir() {
		return "", fmt.Errorf("path 是目录，不是文件: %s", path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}
	mimeType := http.DetectContentType(data)
	ext := filepath.Ext(path)
	var b strings.Builder
	fmt.Fprintf(&b, "文件: %s\n大小: %d bytes\n扩展名: %s\nMIME: %s\n修改时间: %s\n权限: %s\n", path, info.Size(), ext, mimeType, info.ModTime().Format(time.RFC3339), info.Mode().String())
	if strings.HasPrefix(mimeType, "image/") {
		cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
		if err == nil {
			fmt.Fprintf(&b, "图片格式: %s\n宽度: %d\n高度: %d\n", format, cfg.Width, cfg.Height)
		}
		if exif := parseJPEGEXIFSummary(data); exif != "" {
			b.WriteString(exif)
		}
	}
	return b.String(), nil
}

func parseJPEGEXIFSummary(data []byte) string {
	if len(data) < 4 || data[0] != 0xff || data[1] != 0xd8 {
		return ""
	}
	for offset := 2; offset+4 <= len(data); {
		if data[offset] != 0xff {
			return ""
		}
		marker := data[offset+1]
		offset += 2
		if marker == 0xd9 || marker == 0xda {
			return ""
		}
		if offset+2 > len(data) {
			return ""
		}
		segLen := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		if segLen < 2 || offset+segLen > len(data) {
			return ""
		}
		segment := data[offset+2 : offset+segLen]
		if marker == 0xe1 && bytes.HasPrefix(segment, []byte("Exif\x00\x00")) {
			return formatEXIFSummary(segment[6:])
		}
		offset += segLen
	}
	return ""
}

func formatEXIFSummary(tiff []byte) string {
	if len(tiff) < 8 {
		return "EXIF: present\n"
	}
	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return "EXIF: present\n"
	}
	if order.Uint16(tiff[2:4]) != 42 {
		return "EXIF: present\n"
	}
	ifdOffset := int(order.Uint32(tiff[4:8]))
	orientation := readEXIFOrientation(tiff, order, ifdOffset)
	if orientation == 0 {
		return "EXIF: present\n"
	}
	return fmt.Sprintf("EXIF: present\nEXIF orientation: %d\n", orientation)
}

func readEXIFOrientation(tiff []byte, order binary.ByteOrder, ifdOffset int) uint16 {
	if ifdOffset < 0 || ifdOffset+2 > len(tiff) {
		return 0
	}
	count := int(order.Uint16(tiff[ifdOffset : ifdOffset+2]))
	entryStart := ifdOffset + 2
	for i := 0; i < count; i++ {
		entry := entryStart + i*12
		if entry+12 > len(tiff) {
			return 0
		}
		tag := order.Uint16(tiff[entry : entry+2])
		fieldType := order.Uint16(tiff[entry+2 : entry+4])
		valueCount := order.Uint32(tiff[entry+4 : entry+8])
		if tag == 0x0112 && fieldType == 3 && valueCount == 1 {
			return order.Uint16(tiff[entry+8 : entry+10])
		}
	}
	return 0
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}
