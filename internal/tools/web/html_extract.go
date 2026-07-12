package web

import (
	"bytes"
	"fmt"
	stdhtml "html"
	"io"
	"mime"
	"net/url"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/charset"
)

type extractedLink struct {
	Text string
	URL  string
}

func decodeTextBody(body []byte, contentType string) (string, error) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil || params["charset"] == "" {
		return string(body), nil
	}
	reader, err := charset.NewReaderLabel(params["charset"], bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	decoded, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

func renderHTMLBody(rawHTML, baseURL, format string, includeLinks bool) (string, error) {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return "", err
	}
	var parsedBase *url.URL
	if baseURL != "" {
		parsedBase, _ = url.Parse(baseURL)
	}
	ex := htmlExtractor{format: format, includeLinks: includeLinks, baseURL: parsedBase}
	ex.walk(doc)
	return ex.result(), nil
}

type htmlExtractor struct {
	format       string
	includeLinks bool
	baseURL      *url.URL
	lines        []string
	links        []extractedLink
}

func (e *htmlExtractor) walk(n *html.Node) {
	if n == nil || skipHTMLNode(n) {
		return
	}
	if n.Type == html.ElementNode {
		switch n.Data {
		case "h1", "h2", "h3", "h4", "h5", "h6":
			text := e.inline(n)
			if text != "" {
				if e.format == "markdown" {
					level := int(n.Data[1] - '0')
					e.addLine(strings.Repeat("#", level) + " " + text)
				} else {
					e.addLine(text)
				}
			}
			return
		case "p", "figcaption", "caption":
			e.addLine(e.inline(n))
			return
		case "li":
			text := e.inline(n)
			if text != "" {
				e.addLine("- " + text)
			}
			return
		case "pre", "code":
			text := strings.TrimSpace(textContent(n))
			if text != "" {
				if e.format == "markdown" && n.Data == "pre" {
					e.addLine("```\n" + text + "\n```")
				} else {
					e.addLine(text)
				}
			}
			return
		}
	}
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		e.walk(child)
	}
}

func (e *htmlExtractor) inline(n *html.Node) string {
	var b strings.Builder
	e.writeInline(&b, n)
	return cleanInlineText(b.String())
}

func (e *htmlExtractor) writeInline(b *strings.Builder, n *html.Node) {
	if n == nil || skipHTMLNode(n) {
		return
	}
	switch n.Type {
	case html.TextNode:
		text := cleanInlineText(stdhtml.UnescapeString(n.Data))
		if text != "" {
			if b.Len() > 0 && !strings.HasSuffix(b.String(), " ") && !strings.HasSuffix(b.String(), "\n") {
				b.WriteByte(' ')
			}
			b.WriteString(text)
		}
		return
	case html.ElementNode:
		if n.Data == "br" {
			b.WriteByte('\n')
			return
		}
		if n.Data == "a" {
			text := e.inlineChildren(n)
			href := e.attr(n, "href")
			resolved := e.resolveURL(href)
			if text != "" && resolved != "" {
				e.links = append(e.links, extractedLink{Text: text, URL: resolved})
				if e.format == "markdown" && e.includeLinks {
					writeInlineText(b, fmt.Sprintf("[%s](%s)", escapeMarkdown(text), resolved))
					return
				}
			}
			writeInlineText(b, text)
			return
		}
	}
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		e.writeInline(b, child)
	}
}

func (e *htmlExtractor) inlineChildren(n *html.Node) string {
	var b strings.Builder
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		e.writeInline(&b, child)
	}
	return cleanInlineText(b.String())
}

func (e *htmlExtractor) addLine(line string) {
	line = strings.TrimSpace(line)
	if line == "" {
		return
	}
	if len(e.lines) > 0 && e.lines[len(e.lines)-1] == line {
		return
	}
	e.lines = append(e.lines, line)
}

func (e *htmlExtractor) result() string {
	lines := e.lines
	if len(lines) > 400 {
		lines = lines[:400]
	}
	sep := "\n"
	if e.format == "markdown" {
		sep = "\n\n"
	}
	result := strings.Join(lines, sep)
	if e.includeLinks && e.format != "markdown" && len(e.links) > 0 {
		result += "\n\nLinks:"
		for _, link := range dedupeLinks(e.links) {
			result += fmt.Sprintf("\n- %s: %s", link.Text, link.URL)
		}
	}
	return strings.TrimSpace(result)
}

func (e *htmlExtractor) attr(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if strings.EqualFold(attr.Key, key) {
			return strings.TrimSpace(attr.Val)
		}
	}
	return ""
}

func (e *htmlExtractor) resolveURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "javascript:") || strings.HasPrefix(raw, "mailto:") {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if e.baseURL != nil {
		return e.baseURL.ResolveReference(u).String()
	}
	return u.String()
}

func skipHTMLNode(n *html.Node) bool {
	if n.Type == html.CommentNode {
		return true
	}
	if n.Type != html.ElementNode {
		return false
	}
	switch n.Data {
	case "script", "style", "noscript", "template", "svg", "canvas", "head", "meta", "link", "title":
		return true
	default:
		return false
	}
}

func textContent(n *html.Node) string {
	if n == nil || skipHTMLNode(n) {
		return ""
	}
	if n.Type == html.TextNode {
		return n.Data
	}
	var b strings.Builder
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		b.WriteString(textContent(child))
	}
	return b.String()
}

func cleanInlineText(text string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
}

func writeInlineText(b *strings.Builder, text string) {
	text = cleanInlineText(text)
	if text == "" {
		return
	}
	if b.Len() > 0 && !strings.HasSuffix(b.String(), " ") && !strings.HasSuffix(b.String(), "\n") {
		b.WriteByte(' ')
	}
	b.WriteString(text)
}

func escapeMarkdown(text string) string {
	text = strings.ReplaceAll(text, "[", "\\[")
	text = strings.ReplaceAll(text, "]", "\\]")
	return text
}

func dedupeLinks(links []extractedLink) []extractedLink {
	out := make([]extractedLink, 0, len(links))
	seen := make(map[string]bool)
	for _, link := range links {
		key := link.Text + "\x00" + link.URL
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, link)
	}
	return out
}
