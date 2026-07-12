package web

import (
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func withSearchGlobals(t *testing.T, fn func()) {
	t.Helper()
	oldAPIKey := SearchAPIKey
	oldEngine := SearchEngine
	oldBaseURL := SearchBaseURL
	oldBing := BingSearchBaseURL
	oldDDGAPI := DDGAPIBaseURL
	oldDDGHTML := DDGHTMLBaseURL
	oldClient := webSearchHTTPClient
	t.Cleanup(func() {
		SearchAPIKey = oldAPIKey
		SearchEngine = oldEngine
		SearchBaseURL = oldBaseURL
		BingSearchBaseURL = oldBing
		DDGAPIBaseURL = oldDDGAPI
		DDGHTMLBaseURL = oldDDGHTML
		webSearchHTTPClient = oldClient
	})
	SearchAPIKey = ""
	SearchEngine = ""
	SearchBaseURL = ""
	webSearchHTTPClient = &http.Client{Timeout: 2 * time.Second}
	fn()
}

func TestSearchDefaultUsesBingFirst(t *testing.T) {
	withSearchGlobals(t, func() {
		var bingHits, ddgHits int
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/bing":
				bingHits++
				_, _ = w.Write([]byte(`<li class="b_algo"><h2><a href="https://example.com/a">Bing Result</a></h2><p class="b_caption">Bing snippet</p></li>`))
			case "/ddg":
				ddgHits++
				_, _ = w.Write([]byte(`{"Abstract":"DDG result","AbstractURL":"https://example.com/ddg","RelatedTopics":[]}`))
			default:
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
		}))
		defer server.Close()

		BingSearchBaseURL = server.URL + "/bing"
		DDGAPIBaseURL = server.URL + "/ddg"
		result, err := (&Search{}).Execute(map[string]any{"query": "natalia", "limit": "3"})
		if err != nil {
			t.Fatal(err)
		}
		if bingHits != 1 || ddgHits != 0 || !strings.Contains(result, "Bing Result") {
			t.Fatalf("expected Bing-first result, bing=%d ddg=%d result=%q", bingHits, ddgHits, result)
		}
	})
}

func TestSearchDefaultFallsBackToDuckDuckGo(t *testing.T) {
	withSearchGlobals(t, func() {
		var bingHits, ddgHits int
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/bing":
				bingHits++
				_, _ = w.Write([]byte(`<html></html>`))
			case "/ddg":
				ddgHits++
				_, _ = w.Write([]byte(`{"Abstract":"DDG result","AbstractURL":"https://example.com/ddg","RelatedTopics":[]}`))
			default:
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
		}))
		defer server.Close()

		BingSearchBaseURL = server.URL + "/bing"
		DDGAPIBaseURL = server.URL + "/ddg"
		result, err := (&Search{}).Execute(map[string]any{"query": "natalia", "limit": "3"})
		if err != nil {
			t.Fatal(err)
		}
		if bingHits != 1 || ddgHits != 1 || !strings.Contains(result, "DDG result") {
			t.Fatalf("expected DDG fallback, bing=%d ddg=%d result=%q", bingHits, ddgHits, result)
		}
	})
}

func TestSearchDuckDuckGoEngineSkipsBing(t *testing.T) {
	withSearchGlobals(t, func() {
		var bingHits, ddgHits int
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/bing":
				bingHits++
			case "/ddg":
				ddgHits++
				_, _ = w.Write([]byte(`{"Abstract":"DDG result","AbstractURL":"https://example.com/ddg","RelatedTopics":[]}`))
			default:
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
		}))
		defer server.Close()

		SearchEngine = "duckduckgo"
		BingSearchBaseURL = server.URL + "/bing"
		DDGAPIBaseURL = server.URL + "/ddg"
		result, err := (&Search{}).Execute(map[string]any{"query": "natalia", "limit": "3"})
		if err != nil {
			t.Fatal(err)
		}
		if bingHits != 0 || ddgHits != 1 || !strings.Contains(result, "DDG result") {
			t.Fatalf("expected explicit DDG to skip Bing, bing=%d ddg=%d result=%q", bingHits, ddgHits, result)
		}
	})
}

func TestFetchHTMLFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><body><h1>Hello</h1><script>bad()</script><p>World</p></body></html>`))
	}))
	defer server.Close()

	result, err := (&Fetch{}).Execute(map[string]any{"url": server.URL, "format": "html"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "<h1>Hello</h1>") || strings.Contains(result, "bad()") == false {
		t.Fatalf("expected raw html format, got %q", result)
	}
}

func TestFetchTextStripsHTMLAndScript(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><body><h1>Hello</h1><script>bad()</script><p>World</p></body></html>`))
	}))
	defer server.Close()

	result, err := (&Fetch{}).Execute(map[string]any{"url": server.URL})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Hello") || !strings.Contains(result, "World") || strings.Contains(result, "bad()") || strings.Contains(result, "<h1>") {
		t.Fatalf("expected stripped text, got %q", result)
	}
}

func TestFetchMaxBytesTruncates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("1234567890"))
	}))
	defer server.Close()

	result, err := (&Fetch{}).Execute(map[string]any{"url": server.URL, "max_bytes": "5"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "12345") || !strings.Contains(result, "response truncated at 5 bytes") || strings.Contains(result, "67890") {
		t.Fatalf("expected truncated response, got %q", result)
	}
}

func TestFetchBinaryResponseReturnsMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write([]byte{'a', 0, 'b'})
	}))
	defer server.Close()

	result, err := (&Fetch{}).Execute(map[string]any{"url": server.URL})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Binary response not included") || strings.Contains(result, "a\x00b") {
		t.Fatalf("expected binary metadata only, got %q", result)
	}
}

func TestFetchRejectsInvalidOptions(t *testing.T) {
	_, err := (&Fetch{}).Execute(map[string]any{"url": "http://example.com", "format": "pdf"})
	if err == nil || !strings.Contains(err.Error(), "format") {
		t.Fatalf("expected invalid format error, got %v", err)
	}
	_, err = (&Fetch{}).Execute(map[string]any{"url": "http://example.com", "timeout": "0"})
	if err == nil || !strings.Contains(err.Error(), "timeout") {
		t.Fatalf("expected invalid timeout error, got %v", err)
	}
}

func TestMediaFileImageDimensions(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "tiny.png")
	img := image.NewRGBA(image.Rect(0, 0, 2, 3))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(file, img); err != nil {
		_ = file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	result, err := (&MediaFile{}).Execute(map[string]any{"path": path})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"MIME: image/png", "图片格式: png", "宽度: 2", "高度: 3"} {
		if !strings.Contains(result, want) {
			t.Fatalf("expected media result to contain %q, got %q", want, result)
		}
	}
}

func TestMediaFileGenericFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "note.txt")
	if err := os.WriteFile(path, []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&MediaFile{}).Execute(map[string]any{"path": path})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "MIME: text/plain") || !strings.Contains(result, "扩展名: .txt") {
		t.Fatalf("unexpected generic file info: %q", result)
	}
}

func TestMediaFileRejectsDirectory(t *testing.T) {
	_, err := (&MediaFile{}).Execute(map[string]any{"path": t.TempDir()})
	if err == nil || !strings.Contains(err.Error(), "目录") {
		t.Fatalf("expected directory rejection, got %v", err)
	}
}
