package browser

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseWait(t *testing.T) {
	got, err := parseWait("5")
	if err != nil || got != 5 {
		t.Fatalf("expected wait 5, got %d err=%v", got, err)
	}
	if _, err := parseWait("abc"); err == nil {
		t.Fatal("expected invalid wait error")
	}
	if _, err := parseWait("61"); err == nil {
		t.Fatal("expected max wait error")
	}
}

func TestParseViewport(t *testing.T) {
	w, h, err := parseViewport("1280x720")
	if err != nil || w != 1280 || h != 720 {
		t.Fatalf("expected 1280x720, got %dx%d err=%v", w, h, err)
	}
	if _, _, err := parseViewport("bad"); err == nil {
		t.Fatal("expected invalid viewport error")
	}
	if _, _, err := parseViewport("10x720"); err == nil {
		t.Fatal("expected min viewport width error")
	}
}

func TestParsePageOptions(t *testing.T) {
	options, err := parsePageOptions(map[string]any{"wait": "2", "timeout": "10", "viewport": "1024x768", "selector": "#main"})
	if err != nil {
		t.Fatal(err)
	}
	if options.WaitSec != 2 || options.TimeoutSec != 10 || options.ViewportWidth != 1024 || options.ViewportHeight != 768 || options.Selector != "#main" {
		t.Fatalf("unexpected options: %+v", options)
	}
}

func TestParsePageOptionsDefaults(t *testing.T) {
	options, err := parsePageOptions(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if options.WaitSec != 3 || options.TimeoutSec != 30 || options.ViewportWidth != 0 || options.ViewportHeight != 0 || options.Selector != "" {
		t.Fatalf("unexpected default options: %+v", options)
	}
}

func TestParsePageOptionsRejectsInvalidTimeout(t *testing.T) {
	if _, err := parsePageOptions(map[string]any{"timeout": "121"}); err == nil {
		t.Fatal("expected invalid timeout error")
	}
}

func TestCloseWithoutBrowser(t *testing.T) {
	if err := Close(); err != nil {
		t.Fatalf("expected close without browser to be no-op, got %v", err)
	}
}

func TestBrowserVisitAndScreenshotLocalPage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<!doctype html><html><head><title>Browser Smoke</title></head><body><main id="main">initial</main><script>document.querySelector('#main').innerText = 'selector rendered ok';</script></body></html>`))
	}))
	defer server.Close()
	t.Cleanup(func() { _ = Close() })

	visit, err := (&Visit{}).Execute(map[string]any{"url": server.URL, "selector": "#main", "wait": "0", "timeout": "10", "viewport": "800x600"})
	if err != nil {
		if isBrowserUnavailable(err) {
			t.Skipf("browser unavailable in this environment: %v", err)
		}
		t.Fatal(err)
	}
	if !strings.Contains(visit, "Browser Smoke") || !strings.Contains(visit, "selector rendered ok") || strings.Contains(visit, "initial") {
		t.Fatalf("expected rendered selector text, got %q", visit)
	}

	shotPath := filepath.Join(t.TempDir(), "shot.png")
	shot, err := (&Screenshot{}).Execute(map[string]any{"url": server.URL, "path": shotPath, "selector": "#main", "wait": "0", "timeout": "10", "viewport": "800x600"})
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(shotPath)
	if err != nil {
		t.Fatalf("expected screenshot file: %v", err)
	}
	if info.Size() == 0 || !strings.Contains(shot, shotPath) {
		t.Fatalf("expected non-empty screenshot result, size=%d output=%q", info.Size(), shot)
	}
}

func isBrowserUnavailable(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "启动浏览器失败") || strings.Contains(msg, "连接浏览器失败")
}
