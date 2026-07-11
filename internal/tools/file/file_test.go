package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadSmallFileReturnsNumberedContent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "small.txt")
	os.WriteFile(path, []byte("alpha\nbeta"), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path})
	if err != nil {
		t.Fatal(err)
	}
	if result != "1: alpha\n2: beta" {
		t.Fatalf("unexpected read result: %q", result)
	}
}

func TestReadSchemaGeneratedFromParams(t *testing.T) {
	read := &Read{}
	props := read.Parameters()
	required := read.Required()
	if props["path"].Type != "string" || props["offset"].Description == "" || props["limit"].Description == "" {
		t.Fatalf("unexpected read schema: %+v", props)
	}
	if len(required) != 1 || required[0] != "path" {
		t.Fatalf("unexpected required fields: %+v", required)
	}
}

func TestReadRequiresPath(t *testing.T) {
	_, err := (&Read{}).Execute(map[string]any{})
	if err == nil || !strings.Contains(err.Error(), `missing required parameter "path"`) {
		t.Fatalf("expected missing path error, got %v", err)
	}
}

func TestReadLargeFileDefaultsToOverview(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "large.txt")
	var b strings.Builder
	for i := 1; i <= 130; i++ {
		fmt.Fprintf(&b, "line %03d", i)
		if i < 130 {
			b.WriteString("\n")
		}
	}
	os.WriteFile(path, []byte(b.String()), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 130 total") || !strings.Contains(result, `offset "1" and limit "100"`) || !strings.Contains(result, `limit "all"`) {
		t.Fatalf("expected large file window hint, got %q", result)
	}
	if strings.Contains(result, "1: line 001") {
		t.Fatalf("expected overview only without file body, got %q", result)
	}
}

func TestReadFileLimitRange(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "range.txt")
	os.WriteFile(path, []byte("one\ntwo\nthree\nfour"), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path, "limit": "2-3"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 4 total, showing 2-3") || !strings.Contains(result, "2: two\n3: three") || strings.Contains(result, "1: one") {
		t.Fatalf("unexpected limited read result: %q", result)
	}
}

func TestReadFileLimitStartUsesWindow(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "start.txt")
	var b strings.Builder
	for i := 1; i <= 150; i++ {
		fmt.Fprintf(&b, "line %03d", i)
		if i < 150 {
			b.WriteString("\n")
		}
	}
	os.WriteFile(path, []byte(b.String()), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path, "limit": "51"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 150 total, showing 51-150") || !strings.Contains(result, "51: line 051") || !strings.Contains(result, "150: line 150") {
		t.Fatalf("unexpected window read result: %q", result)
	}
}

func TestReadFileOffsetAndLimitCount(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "offset.txt")
	var b strings.Builder
	for i := 1; i <= 20; i++ {
		fmt.Fprintf(&b, "line %03d", i)
		if i < 20 {
			b.WriteString("\n")
		}
	}
	os.WriteFile(path, []byte(b.String()), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path, "offset": "6", "limit": "4"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 20 total, showing 6-9") || !strings.Contains(result, "6: line 006") || !strings.Contains(result, "9: line 009") || strings.Contains(result, "10: line 010") {
		t.Fatalf("unexpected offset read result: %q", result)
	}
}

func TestReadFileOffsetDefaultsToWindow(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "offset-default.txt")
	var b strings.Builder
	for i := 1; i <= 120; i++ {
		fmt.Fprintf(&b, "line %03d", i)
		if i < 120 {
			b.WriteString("\n")
		}
	}
	os.WriteFile(path, []byte(b.String()), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path, "offset": "21"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 120 total, showing 21-120") || !strings.Contains(result, "21: line 021") || !strings.Contains(result, "120: line 120") {
		t.Fatalf("unexpected default offset window: %q", result)
	}
}

func TestReadFileLimitAllReadsWholeFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "all.txt")
	os.WriteFile(path, []byte("one\ntwo\nthree"), 0644)

	r := &Read{}
	result, err := r.Execute(map[string]any{"path": path, "limit": "all"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 3 total, showing 1-3") || !strings.Contains(result, "1: one\n2: two\n3: three") {
		t.Fatalf("unexpected full read result: %q", result)
	}
}

func TestGrep(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "test.go"), []byte("package main\nfunc main() {}\n"), 0644)

	g := &Grep{}
	result, err := g.Execute(map[string]any{
		"pattern": "func",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "func main") {
		t.Errorf("expected 'func main', got %s", result)
	}
}

func TestGrepNoMatch(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "test.txt"), []byte("hello"), 0644)

	g := &Grep{}
	result, err := g.Execute(map[string]any{
		"pattern": "zzzzz",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "未找到") {
		t.Errorf("expected '未找到', got %s", result)
	}
}

func TestGrepWithInclude(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.go"), []byte("go file"), 0644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("text file"), 0644)

	g := &Grep{}
	result, _ := g.Execute(map[string]any{
		"pattern": "file",
		"path":    dir,
		"include": "*.go",
	})
	if strings.Contains(result, "text") {
		t.Error("should not match .txt files")
	}
	if !strings.Contains(result, "go") {
		t.Error("should match .go files")
	}
}

func TestGrepTruncatesAtResultLimit(t *testing.T) {
	dir := t.TempDir()
	var b strings.Builder
	for i := 0; i < 250; i++ {
		fmt.Fprintf(&b, "match %03d\n", i)
	}
	os.WriteFile(filepath.Join(dir, "many.txt"), []byte(b.String()), 0644)

	g := &Grep{}
	result, err := g.Execute(map[string]any{"pattern": "match", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "[grep results truncated at 200 matches]") {
		t.Fatalf("expected grep truncation marker, got %q", result)
	}
	if strings.Contains(result, "match 249") {
		t.Fatalf("expected late matches to be omitted, got %q", result)
	}
}

func TestGlobBasic(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.go"), []byte("a"), 0644)
	os.WriteFile(filepath.Join(dir, "b.go"), []byte("b"), 0644)

	g := &Glob{}
	result, err := g.Execute(map[string]any{
		"pattern": "*.go",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "a.go") || !strings.Contains(result, "b.go") {
		t.Errorf("expected both .go files, got %s", result)
	}
}

func TestGlobRecursive(t *testing.T) {
	dir := t.TempDir()
	sub := filepath.Join(dir, "sub")
	os.MkdirAll(sub, 0755)
	os.WriteFile(filepath.Join(sub, "deep.go"), []byte("deep"), 0644)

	g := &Glob{}
	result, err := g.Execute(map[string]any{
		"pattern": "**/*.go",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "deep.go") {
		t.Errorf("expected deep.go in results, got %s", result)
	}
}
