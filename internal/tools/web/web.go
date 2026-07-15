package web

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net"
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

func ResetWebConfigForTest() {
	SearchAPIKey = os.Getenv("SEARCH_API_KEY")
	SearchEngine = os.Getenv("SEARCH_ENGINE")
	SearchProviderPriority = os.Getenv("SEARCH_PROVIDER_PRIORITY")
	SearchBaseURL = os.Getenv("SEARCH_BASE_URL")
	BingSearchBaseURL = "https://www.bing.com/search"
	DDGAPIBaseURL = "https://api.duckduckgo.com/"
	DDGHTMLBaseURL = "https://html.duckduckgo.com/html/"
	NetworkPolicy = networkpolicy.Default()
	webSearchHTTPClient = NetworkPolicy.HTTPClient(15 * time.Second)
}

type SearchResult struct {
	Title   string
	URL     string
	Snippet string
	Content string
	Date    string
	Source  string
	Score   float64
}

type Search struct{}

func (t *Search) Name() string { return "web_search" }
func (t *Search) Description() string {
	return "search the web and return relevant results; provider configuration is internal and diagnostics are summarized for user safety"
}
func (t *Search) Required() []string { return []string{"query"} }
func (t *Search) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"query":             {Type: "string", Description: "search query"},
		"limit":             {Type: "integer", Description: "optional, number of results to return; default 5"},
		"include_content":   {Type: "boolean", Description: "optional, also fetch page content when true (costs more tokens)"},
		"provider_priority": {Type: "string", Description: "optional, search provider order like bing,google,duckduckgo"},
	}
}
func (t *Search) Execute(args map[string]any) (string, error) {
	query, _ := args["query"].(string)
	if query == "" {
		return "", fmt.Errorf("query is required")
	}

	limit := 5
	if l, ok := args["limit"].(float64); ok {
		if l >= 1 && l <= 20 {
			limit = int(l)
		}
	} else if l, ok := args["limit"].(string); ok {
		parsed, err := strconv.Atoi(strings.TrimSpace(l))
		if err == nil && parsed >= 1 && parsed <= 20 {
			limit = parsed
		}
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
		return "", fmt.Errorf("搜索失败: %s", sanitizeSearchDiagnostic(err))
	}
	if len(results) == 0 {
		msg := fmt.Sprintf("no results found for %q", query)
		if len(diagnostics) > 0 {
			msg += "\n搜索诊断:\n- " + strings.Join(diagnostics, "\n- ")
		}
		return msg, nil
	}
	if warning := searchRelevanceWarning(query, results); warning != "" {
		diagnostics = append(diagnostics, warning)
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

func searchRelevanceWarning(query string, results []SearchResult) string {
	terms := queryTerms(query)
	if len(terms) == 0 || len(results) == 0 {
		return ""
	}
	relevant := 0
	for _, result := range results {
		if result.Score >= 0.1 {
			relevant++
		}
	}
	if relevant == 0 || relevant*2 < len(results) {
		return fmt.Sprintf("结果可能与查询 %q 不够相关，请验证来源或调整关键词", query)
	}
	return ""
}

func queryTerms(query string) []string {
	fields := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9')
	})
	terms := make([]string, 0, len(fields))
	for _, field := range fields {
		if len(field) >= 3 {
			terms = append(terms, field)
		}
	}
	return terms
}

func searchResultScore(result SearchResult, terms []string) float64 {
	if len(terms) == 0 {
		return 0
	}
	haystack := strings.ToLower(result.Title + " " + result.Snippet + " " + result.URL)
	matched := 0
	for _, term := range terms {
		if strings.Contains(haystack, term) {
			matched++
		}
	}
	return float64(matched) / float64(len(terms))
}

func scoreResults(query string, results []SearchResult) []SearchResult {
	terms := queryTerms(query)
	if len(terms) == 0 {
		return results
	}
	for i := range results {
		results[i].Score = searchResultScore(results[i], terms)
	}
	return results
}

func searchDefault(query string, limit int) ([]SearchResult, error) {
	results, _, err := searchByPriority(query, limit, defaultSearchProviderPriority())
	return scoreResults(query, results), err

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
			diagnostics = appendUniqueDiagnostic(diagnostics, sanitizeSearchDiagnostic(err))
			continue
		}
		results = scoreResults(query, results)
		if len(results) == 0 {
			diagnostics = appendUniqueDiagnostic(diagnostics, "未找到可用搜索结果")
			continue
		}
		if warning := searchRelevanceWarning(query, results); warning != "" && hasRemainingProvider(providers, provider) {
			diagnostics = appendUniqueDiagnostic(diagnostics, "部分搜索结果相关性较低，已继续尝试其他结果来源")
			continue
		}
		return results, diagnostics, nil
	}
	return nil, diagnostics, nil
}

func hasRemainingProvider(providers []string, current string) bool {
	seenCurrent := false
	for _, provider := range providers {
		provider = normalizeSearchProvider(provider)
		if provider == "" {
			continue
		}
		if seenCurrent {
			return true
		}
		if provider == current {
			seenCurrent = true
		}
	}
	return false
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
	if err == nil {
		return "搜索服务暂时不可用，请稍后重试或调整关键词"
	}
	if strings.Contains(err.Error(), "network policy denied") {
		return err.Error()
	}
	if isTimeoutError(err) {
		return "搜索服务暂时无响应，请稍后重试"
	}
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "missing") || strings.Contains(lower, "api_key") || strings.Contains(lower, "key") || strings.Contains(lower, "cx") {
		return "搜索服务尚未配置或暂时不可用，请尝试其他关键词或稍后重试"
	}
	if strings.Contains(lower, "rate limited") || strings.Contains(lower, "429") {
		return "搜索服务请求过于频繁，请稍后重试"
	}
	if strings.Contains(lower, "status") || strings.Contains(lower, "unsupported provider") {
		return "搜索服务暂时不可用，请稍后重试或调整关键词"
	}
	return "搜索服务暂时不可用，请稍后重试或调整关键词"
}

func appendUniqueDiagnostic(diagnostics []string, msg string) []string {
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return diagnostics
	}
	for _, existing := range diagnostics {
		if existing == msg {
			return diagnostics
		}
	}
	return append(diagnostics, msg)
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
	return scoreResults(query, results), nil
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
	return parseDuckDuckGoHTML(string(body), limit), nil
}

func parseDuckDuckGoHTML(html string, limit int) []SearchResult {
	var results []SearchResult

	for i := 0; i < len(html); {
		idx := strings.Index(html[i:], `class="result__a"`)
		if idx < 0 {
			break
		}
		i += idx
		anchorStart := strings.LastIndex(html[:i], "<a ")
		if anchorStart < 0 {
			i++
			continue
		}
		anchorEnd := strings.Index(html[anchorStart:], ">")
		if anchorEnd < 0 {
			break
		}
		anchor := html[anchorStart : anchorStart+anchorEnd+1]
		_, href := extractFirstAnchor(anchor + "</a>")
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

		if !isValidResultURL(href) {
			continue
		}
		results = append(results, SearchResult{
			Title:   strings.TrimSpace(title),
			URL:     href,
			Snippet: strings.TrimSpace(snippet),
			Source:  "duckduckgo",
		})
		if len(results) >= limit {
			break
		}
	}

	if len(results) == 0 {
		return nil
	}
	return results
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
		if title == "" || !isValidResultURL(href) {
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

func isValidResultURL(rawURL string) bool {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return false
	}
	lower := strings.ToLower(u.Path)
	if strings.Contains(lower, "/rs/") {
		return false
	}
	for _, suffix := range []string{".css", ".js", ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"} {
		if strings.HasSuffix(lower, suffix) {
			return false
		}
	}
	return true
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
func (t *Fetch) Description() string { return "fetch content from a URL and extract readable text" }
func (t *Fetch) Required() []string  { return []string{"url"} }
func (t *Fetch) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url":           {Type: "string", Description: "URL to fetch"},
		"format":        {Type: "string", Description: "optional, text|markdown|html; default text"},
		"timeout":       {Type: "integer", Description: "optional, timeout in seconds; default 60, range 1-120"},
		"max_bytes":     {Type: "integer", Description: "optional, maximum response bytes to read; default 1048576, max 5242880"},
		"include_links": {Type: "boolean", Description: "optional, include page link references in text/markdown output when true"},
	}
}
func (t *Fetch) Execute(args map[string]any) (string, error) {
	u, _ := args["url"].(string)
	if u == "" {
		return "", fmt.Errorf("url is required")
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

	resp, err := doFetchWithTimeoutRetry(client, req, 2)
	if err != nil {
		return "", fmt.Errorf("获取失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("HTTP %d: 页面无法访问", resp.StatusCode)
	}

	finalURL := u
	if resp.Request != nil && resp.Request.URL != nil {
		finalURL = resp.Request.URL.String()
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
	metadata := formatFetchMetadata(finalURL, resp.StatusCode, contentType, len(body), truncated)

	if isBinaryResponse(contentType, body) {
		return metadata + "\nBinary response not included.", nil
	}
	bodyText, err := decodeTextBody(body, contentType)
	if err != nil {
		return "", fmt.Errorf("字符集解码失败: %w", err)
	}
	if format == "html" {
		return metadata + "\n" + appendTruncationMarker(bodyText, truncated, maxBytes), nil
	}
	if strings.Contains(contentType, "text/plain") || strings.Contains(contentType, "text/markdown") {
		return metadata + "\n" + appendTruncationMarker(bodyText, truncated, maxBytes), nil
	}
	if strings.Contains(contentType, "application/json") {
		return metadata + "\n" + appendTruncationMarker(bodyText, truncated, maxBytes), nil
	}

	text, err := renderHTMLBody(bodyText, finalURL, format, includeLinks)
	if err != nil {
		return metadata + "\nHTML parse error: " + err.Error() + "\n\nRaw body:\n" + truncateString(bodyText, 4000), nil
	}
	if text == "" {
		fallback := bodyText
		if len(fallback) > 4000 {
			fallback = fallback[:4000] + "\n[body truncated at 4000 chars]"
		}
		return metadata + "\nNo content extracted.\n\nRaw body:\n" + fallback, nil
	}
	return metadata + "\n" + appendTruncationMarker(text, truncated, maxBytes), nil
}

func doFetchWithTimeoutRetry(client *http.Client, req *http.Request, retries int) (*http.Response, error) {
	if retries < 0 {
		retries = 0
	}
	var lastErr error
	for attempt := 0; attempt <= retries; attempt++ {
		attemptReq := req.Clone(req.Context())
		resp, err := client.Do(attemptReq)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !isTimeoutError(err) || attempt == retries {
			break
		}
		time.Sleep(time.Duration(attempt+1) * 100 * time.Millisecond)
	}
	return nil, lastErr
}

func isTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

func formatFetchMetadata(urlStr string, status int, contentType string, bytes int, truncated bool) string {
	return fmt.Sprintf("URL: %s\nStatus: %d\nContent-Type: %s\nBytes: %d\nTruncated: %t", urlStr, status, contentType, bytes, truncated)
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "\n[truncated]"
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
	return "read media file metadata (image dimensions, format, size, etc.)"
}
func (t *MediaFile) Required() []string { return []string{"path"} }
func (t *MediaFile) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path": {Type: "string", Description: "media file path"},
	}
}
func (t *MediaFile) Execute(args map[string]any) (string, error) {
	return executeFileInfo(args)
}

type FileInfo struct{}

func (t *FileInfo) Name() string { return "file_info" }
func (t *FileInfo) Description() string {
	return "read file metadata (size, MIME, image dimensions, basic EXIF metadata); newer name for read_media_file"
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
		return "", fmt.Errorf("path is required")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("file not found: %w", err)
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
