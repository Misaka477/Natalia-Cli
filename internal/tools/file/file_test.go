package file

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aquama/natalia-cli/internal/display"
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

func TestReadFilePreservesTrailingBlankLine(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "trailing.txt")
	os.WriteFile(path, []byte("alpha\n"), 0644)

	result, err := (&Read{}).Execute(map[string]any{"path": path, "limit": "all"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 2 total") || !strings.Contains(result, "1: alpha\n2: ") {
		t.Fatalf("unexpected trailing newline rendering: %q", result)
	}
}

func TestReadFileEmptyFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "empty.txt")
	os.WriteFile(path, []byte(""), 0644)

	result, err := (&Read{}).Execute(map[string]any{"path": path})
	if err != nil {
		t.Fatal(err)
	}
	if result != "1: " {
		t.Fatalf("unexpected empty file rendering: %q", result)
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

func TestWriteFileRequiresExistingParentAndReportsMetadata(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	result, err := (&Write{}).Execute(map[string]any{"path": path, "content": "one\ntwo"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "7 bytes") || !strings.Contains(result, "2 lines") {
		t.Fatalf("expected write metadata, got %q", result)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "one\ntwo" {
		t.Fatalf("unexpected file content: %q", data)
	}
}

func TestWriteFileRejectsMissingParent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "out.txt")
	_, err := (&Write{}).Execute(map[string]any{"path": path, "content": "data"})
	if err == nil || !strings.Contains(err.Error(), "parent directory") {
		t.Fatalf("expected parent directory error, got %v", err)
	}
}

func TestWriteFileRejectsBinaryContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "out.txt")
	_, err := (&Write{}).Execute(map[string]any{"path": path, "content": "a\x00b"})
	if err == nil || !strings.Contains(err.Error(), "binary") {
		t.Fatalf("expected binary content error, got %v", err)
	}
}

func TestWriteFileRejectsLargeContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "out.txt")
	_, err := (&Write{}).Execute(map[string]any{"path": path, "content": strings.Repeat("x", maxWriteFileBytes+1)})
	if err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("expected size limit error, got %v", err)
	}
}

func TestEditExecuteReturnIncludesDiffDisplay(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "edit.txt")
	if err := os.WriteFile(path, []byte("one\ntwo\nthree"), 0644); err != nil {
		t.Fatal(err)
	}

	ret, err := (&Edit{}).ExecuteReturn(map[string]any{"path": path, "old_string": "two", "new_string": "TWO"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ret.ModelText, "替换 1 处") || len(ret.Display) != 1 || ret.Display[0].Type != display.BlockDiff {
		t.Fatalf("expected diff display block, got %+v", ret)
	}
	var payload display.DiffBlock
	if err := json.Unmarshal(ret.Display[0].Data, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Path != path || !strings.Contains(payload.Diff, "-two") || !strings.Contains(payload.Diff, "+TWO") {
		t.Fatalf("unexpected diff payload: %+v", payload)
	}
}

func TestEditDefaultsToSingleReplacement(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "single.txt")
	if err := os.WriteFile(path, []byte("foo foo foo"), 0644); err != nil {
		t.Fatal(err)
	}

	ret, err := (&Edit{}).ExecuteReturn(map[string]any{"path": path, "old_string": "foo", "new_string": "bar"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ret.ModelText, "替换 1 处") {
		t.Fatalf("expected single replacement metadata, got %q", ret.ModelText)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "bar foo foo" {
		t.Fatalf("expected only first match replaced, got %q", data)
	}
}

func TestEditReplaceAll(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "all.txt")
	if err := os.WriteFile(path, []byte("foo foo foo"), 0644); err != nil {
		t.Fatal(err)
	}

	ret, err := (&Edit{}).ExecuteReturn(map[string]any{"path": path, "old_string": "foo", "new_string": "bar", "replace_all": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ret.ModelText, "替换 3 处") {
		t.Fatalf("expected replace_all metadata, got %q", ret.ModelText)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "bar bar bar" {
		t.Fatalf("expected all matches replaced, got %q", data)
	}
}

func TestEditBatchAppliesSequentialEdits(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "batch.txt")
	if err := os.WriteFile(path, []byte("alpha beta gamma"), 0644); err != nil {
		t.Fatal(err)
	}

	ret, err := (&Edit{}).ExecuteReturn(map[string]any{
		"path": path,
		"edits": []any{
			map[string]any{"old_string": "alpha", "new_string": "ALPHA"},
			map[string]any{"old_string": "beta", "new_string": "BETA"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ret.ModelText, "替换 2 处") || len(ret.Display) != 1 {
		t.Fatalf("expected batch metadata and diff display, got %+v", ret)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "ALPHA BETA gamma" {
		t.Fatalf("unexpected batch edit result: %q", data)
	}
}

func TestEditBatchFailsWithoutPartialWrite(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "batch-fail.txt")
	original := "alpha beta gamma"
	if err := os.WriteFile(path, []byte(original), 0644); err != nil {
		t.Fatal(err)
	}

	ret, err := (&Edit{}).ExecuteReturn(map[string]any{
		"path": path,
		"edits": []any{
			map[string]any{"old_string": "alpha", "new_string": "ALPHA"},
			map[string]any{"old_string": "missing", "new_string": "MISSING"},
		},
	})
	if err == nil || !ret.IsError || !strings.Contains(err.Error(), "edit 2") {
		t.Fatalf("expected edit 2 error, ret=%+v err=%v", ret, err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != original {
		t.Fatalf("batch edit should not partially write, got %q", data)
	}
}

func TestEditBatchRejectsInvalidEdits(t *testing.T) {
	_, err := (&Edit{}).ExecuteReturn(map[string]any{"path": "x", "edits": []any{map[string]any{"new_string": "x"}}})
	if err == nil || !strings.Contains(err.Error(), "old_string required") {
		t.Fatalf("expected old_string validation error, got %v", err)
	}
}

func TestEditExecuteReturnErrorHasNoDisplay(t *testing.T) {
	ret, err := (&Edit{}).ExecuteReturn(map[string]any{"path": "", "old_string": "x", "new_string": "y"})
	if err == nil || !ret.IsError || len(ret.Display) != 0 {
		t.Fatalf("expected validation error without display, ret=%+v err=%v", ret, err)
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

func TestGrepHeadLimit(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "many.txt"), []byte("match 1\nmatch 2\nmatch 3\n"), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "match", "path": dir, "head_limit": float64(2)})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(result, "many.txt") != 2 || !strings.Contains(result, "[grep results truncated at 2 matches]") || strings.Contains(result, "match 3") {
		t.Fatalf("unexpected head_limit result: %q", result)
	}
}

func TestGrepRejectsInvalidHeadLimit(t *testing.T) {
	_, err := (&Grep{}).Execute(map[string]any{"pattern": "x", "head_limit": float64(0)})
	if err == nil || !strings.Contains(err.Error(), "head_limit") {
		t.Fatalf("expected head_limit validation error, got %v", err)
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
