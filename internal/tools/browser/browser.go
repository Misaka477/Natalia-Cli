package browser

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
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

func (t *Visit) Name() string { return "browser_visit" }
func (t *Visit) Description() string {
	return "用真实浏览器访问网页，支持 JS 渲染，规避反爬虫。返回页面标题和正文"
}
func (t *Visit) Required() []string { return []string{"url"} }
func (t *Visit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url":  {Type: "string", Description: "要访问的网页 URL"},
		"wait": {Type: "string", Description: "可选，等待秒数，默认 3"},
	}
}
func (t *Visit) Execute(args map[string]any) (string, error) {
	u, _ := args["url"].(string)
	if u == "" {
		return "", fmt.Errorf("url 是必填参数")
	}
	waitSec := 3
	if w, ok := args["wait"].(string); ok {
		parsed, err := parseWait(w)
		if err != nil {
			return "", err
		}
		waitSec = parsed
	}

	b, err := getBrowser()
	if err != nil {
		return "", err
	}

	page, err := b.Page(proto.TargetCreateTarget{})
	if err != nil {
		return "", fmt.Errorf("创建页面失败: %w", err)
	}
	defer page.Close()

	if err := page.Navigate(u); err != nil {
		return "", fmt.Errorf("导航失败: %w", err)
	}
	page.WaitLoad()
	time.Sleep(time.Duration(waitSec) * time.Second)

	title, _ := page.Eval(`() => document.title`)
	bodyText, _ := page.Eval(`() => document.body.innerText`)

	titleStr := ""
	if title != nil {
		titleStr = title.Value.String()
	}
	text := ""
	if bodyText != nil {
		text = strings.TrimSpace(bodyText.Value.String())
	}

	if len([]rune(text)) > 5000 {
		text = string([]rune(text)[:5000]) + "\n\n...（内容过长已截断）"
	}

	return fmt.Sprintf("标题: %s\n\n%s", titleStr, text), nil
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

type Screenshot struct{}

func (t *Screenshot) Name() string        { return "browser_screenshot" }
func (t *Screenshot) Description() string { return "用真实浏览器打开网页并截图保存" }
func (t *Screenshot) Required() []string  { return []string{"url"} }
func (t *Screenshot) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"url":  {Type: "string", Description: "要截图的网页 URL"},
		"path": {Type: "string", Description: "可选，保存路径，默认 ./screenshot.png"},
		"wait": {Type: "string", Description: "可选，等待秒数，默认 3"},
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
	waitSec := 3
	if w, ok := args["wait"].(string); ok {
		parsed, err := parseWait(w)
		if err != nil {
			return "", err
		}
		waitSec = parsed
	}

	b, err := getBrowser()
	if err != nil {
		return "", err
	}

	page, err := b.Page(proto.TargetCreateTarget{})
	if err != nil {
		return "", fmt.Errorf("创建页面失败: %w", err)
	}
	defer page.Close()

	if err := page.Navigate(u); err != nil {
		return "", fmt.Errorf("导航失败: %w", err)
	}
	page.WaitLoad()
	time.Sleep(time.Duration(waitSec) * time.Second)

	absPath, _ := filepath.Abs(savePath)
	data, err := page.Screenshot(true, nil)
	if err != nil {
		return "", fmt.Errorf("截图失败: %w", err)
	}

	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return "", fmt.Errorf("保存截图失败: %w", err)
	}

	return fmt.Sprintf("截图已保存到 %s (%d bytes)", absPath, len(data)), nil
}
