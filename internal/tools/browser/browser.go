package browser

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/rod/lib/proto"
)

var (
	globalBrowser   *rod.Browser
	globalBrowserMu sync.Mutex
)

func getBrowser() (*rod.Browser, error) {
	globalBrowserMu.Lock()
	defer globalBrowserMu.Unlock()
	if globalBrowser != nil {
		return globalBrowser, nil
	}

	l := launcher.New().
		Headless(true).
		NoSandbox(true).
		Set("disable-gpu", "true").
		Set("disable-dev-shm-usage", "true").
		Set("disable-setuid-sandbox", "true")

	u, err := l.Launch()
	if err != nil {
		return nil, fmt.Errorf("启动浏览器失败: %w", err)
	}

	globalBrowser = rod.New().ControlURL(u)
	if err := globalBrowser.Connect(); err != nil {
		return nil, fmt.Errorf("连接浏览器失败: %w", err)
	}

	return globalBrowser, nil
}

func Close() error {
	globalBrowserMu.Lock()
	defer globalBrowserMu.Unlock()
	if globalBrowser == nil {
		return nil
	}
	err := globalBrowser.Close()
	globalBrowser = nil
	return err
}

type Visit struct{}

type renderedPage struct {
	Title      string
	Text       string
	Screenshot []byte
}

var renderBrowserPage = renderPageWithRod

func (t *Visit) Name() string { return "browser_visit" }
func (t *Visit) Description() string {
	return "用真实浏览器访问网页，支持 JS 渲染，规避反爬虫。返回页面标题和正文"
}
func (t *Visit) Required() []string { return []string{"url"} }
func (t *Visit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url":      {Type: "string", Description: "要访问的网页 URL"},
		"wait":     {Type: "string", Description: "可选，等待秒数，默认 3"},
		"timeout":  {Type: "string", Description: "可选，页面操作超时秒数，默认 30，最大 120"},
		"viewport": {Type: "string", Description: "可选，视口大小，如 1280x720"},
		"selector": {Type: "string", Description: "可选，等待并提取指定 CSS selector 的文本"},
	}
}
func (t *Visit) Execute(args map[string]any) (string, error) {
	u, _ := args["url"].(string)
	if u == "" {
		return "", fmt.Errorf("url 是必填参数")
	}
	options, err := parsePageOptions(args)
	if err != nil {
		return "", err
	}

	rendered, err := renderBrowserPage(u, options, false)
	if err != nil {
		return "", err
	}
	text := strings.TrimSpace(rendered.Text)

	if len([]rune(text)) > 5000 {
		text = string([]rune(text)[:5000]) + "\n\n...（内容过长已截断）"
	}

	return fmt.Sprintf("标题: %s\n\n%s", rendered.Title, text), nil
}

func renderPageWithRod(u string, options pageOptions, includeScreenshot bool) (renderedPage, error) {
	b, err := getBrowser()
	if err != nil {
		return renderedPage{}, err
	}

	page, err := b.Page(proto.TargetCreateTarget{})
	if err != nil {
		return renderedPage{}, fmt.Errorf("创建页面失败: %w", err)
	}
	defer page.Close()
	page = page.Timeout(time.Duration(options.TimeoutSec) * time.Second)
	if options.ViewportWidth > 0 && options.ViewportHeight > 0 {
		if err := page.SetViewport(&proto.EmulationSetDeviceMetricsOverride{Width: options.ViewportWidth, Height: options.ViewportHeight, DeviceScaleFactor: 1, Mobile: false}); err != nil {
			return renderedPage{}, fmt.Errorf("设置 viewport 失败: %w", err)
		}
	}

	if err := page.Navigate(u); err != nil {
		return renderedPage{}, fmt.Errorf("导航失败: %w", err)
	}
	page.WaitLoad()
	if options.Selector != "" {
		if _, err := page.Element(options.Selector); err != nil {
			return renderedPage{}, fmt.Errorf("等待 selector 失败: %w", err)
		}
	}
	time.Sleep(time.Duration(options.WaitSec) * time.Second)

	title, _ := page.Eval(`() => document.title`)
	bodyText, _ := page.Eval(`() => document.body.innerText`)
	if options.Selector != "" {
		bodyText, _ = page.Eval(fmt.Sprintf(`() => document.querySelector(%q)?.innerText || ""`, options.Selector))
	}

	rendered := renderedPage{}
	if title != nil {
		rendered.Title = title.Value.String()
	}
	if bodyText != nil {
		rendered.Text = bodyText.Value.String()
	}
	if includeScreenshot {
		data, err := page.Screenshot(true, nil)
		if err != nil {
			return renderedPage{}, fmt.Errorf("截图失败: %w", err)
		}
		rendered.Screenshot = data
	}
	return rendered, nil
}

func parseWait(raw string) (int, error) {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed < 0 {
		return 0, fmt.Errorf("wait must be a non-negative integer number of seconds")
	}
	if parsed > 60 {
		return 0, fmt.Errorf("wait must be <= 60 seconds")
	}
	return parsed, nil
}

type pageOptions struct {
	WaitSec        int
	TimeoutSec     int
	ViewportWidth  int
	ViewportHeight int
	Selector       string
}

func parsePageOptions(args map[string]any) (pageOptions, error) {
	options := pageOptions{WaitSec: 3, TimeoutSec: 30}
	if w, ok := args["wait"].(string); ok {
		parsed, err := parseWait(w)
		if err != nil {
			return pageOptions{}, err
		}
		options.WaitSec = parsed
	}
	if raw, ok := args["timeout"].(string); ok {
		parsed, err := parseBoundedInt(raw, "timeout", 1, 120)
		if err != nil {
			return pageOptions{}, err
		}
		options.TimeoutSec = parsed
	}
	if raw, ok := args["viewport"].(string); ok && strings.TrimSpace(raw) != "" {
		w, h, err := parseViewport(raw)
		if err != nil {
			return pageOptions{}, err
		}
		options.ViewportWidth = w
		options.ViewportHeight = h
	}
	if selector, ok := args["selector"].(string); ok {
		options.Selector = strings.TrimSpace(selector)
	}
	return options, nil
}

func parseBoundedInt(raw, name string, minValue, maxValue int) (int, error) {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", name)
	}
	if parsed < minValue || parsed > maxValue {
		return 0, fmt.Errorf("%s must be between %d and %d", name, minValue, maxValue)
	}
	return parsed, nil
}

func parseViewport(raw string) (int, int, error) {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(raw)), "x")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("viewport must be WIDTHxHEIGHT")
	}
	width, err := parseBoundedInt(parts[0], "viewport width", 100, 10000)
	if err != nil {
		return 0, 0, err
	}
	height, err := parseBoundedInt(parts[1], "viewport height", 100, 10000)
	if err != nil {
		return 0, 0, err
	}
	return width, height, nil
}

type Screenshot struct{}

func (t *Screenshot) Name() string        { return "browser_screenshot" }
func (t *Screenshot) Description() string { return "用真实浏览器打开网页并截图保存" }
func (t *Screenshot) Required() []string  { return []string{"url"} }
func (t *Screenshot) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url":      {Type: "string", Description: "要截图的网页 URL"},
		"path":     {Type: "string", Description: "可选，保存路径，默认 ./screenshot.png"},
		"wait":     {Type: "string", Description: "可选，等待秒数，默认 3"},
		"timeout":  {Type: "string", Description: "可选，页面操作超时秒数，默认 30，最大 120"},
		"viewport": {Type: "string", Description: "可选，视口大小，如 1280x720"},
		"selector": {Type: "string", Description: "可选，等待指定 CSS selector 后截图"},
	}
}
func (t *Screenshot) Execute(args map[string]any) (string, error) {
	u, _ := args["url"].(string)
	if u == "" {
		return "", fmt.Errorf("url 是必填参数")
	}
	savePath, _ := args["path"].(string)
	if savePath == "" {
		savePath = "./screenshot.png"
	}
	options, err := parsePageOptions(args)
	if err != nil {
		return "", err
	}

	rendered, err := renderBrowserPage(u, options, true)
	if err != nil {
		return "", err
	}

	absPath, _ := filepath.Abs(savePath)
	if err := os.WriteFile(absPath, rendered.Screenshot, 0644); err != nil {
		return "", fmt.Errorf("保存截图失败: %w", err)
	}

	return fmt.Sprintf("截图已保存到 %s (%d bytes)", absPath, len(rendered.Screenshot)), nil
}
