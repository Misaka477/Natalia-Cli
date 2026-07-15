package file

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

func TestReadSchemaAndSmallFileExecution(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "small.txt")
	os.WriteFile(path, []byte("alpha\nbeta"), 0644)

	r := &Read{}
	props := r.Parameters()
	required := r.Required()
	if props["path"].Type != "string" || props["offset"].Description == "" || props["limit"].Description == "" {
		t.Fatalf("unexpected read schema: %+v", props)
	}
	if len(required) != 1 || required[0] != "path" {
		t.Fatalf("unexpected required fields: %+v", required)
	}
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

func TestReadRequiresPath(t *testing.T) {
	_, err := (&Read{}).Execute(map[string]any{})
	if err == nil || !strings.Contains(err.Error(), `missing required parameter "path"`) {
		t.Fatalf("expected missing path error, got %v", err)
	}
}

func TestReadUsesInjectedGuardAndRejectsBinary(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "blocked.txt")
	if err := os.WriteFile(path, []byte("alpha"), 0644); err != nil {
		t.Fatal(err)
	}
	guardErr := fmt.Errorf("blocked by policy")
	_, err := (&Read{Guard: func(got string) error {
		if got != path {
			t.Fatalf("guard saw path %q want %q", got, path)
		}
		return guardErr
	}}).Execute(map[string]any{"path": path})
	if err != guardErr {
		t.Fatalf("expected guard error, got %v", err)
	}
	binaryPath := filepath.Join(dir, "bin.dat")
	if err := os.WriteFile(binaryPath, []byte{'a', 0, 'b'}, 0644); err != nil {
		t.Fatal(err)
	}
	_, err = (&Read{}).Execute(map[string]any{"path": binaryPath})
	if err == nil || !strings.Contains(err.Error(), "binary file") {
		t.Fatalf("expected binary read rejection, got %v", err)
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

func TestReadExactDefaultWindowSizeDoesNotUseOverview(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "exact.txt")
	var b strings.Builder
	for i := 1; i <= defaultReadWindowLines; i++ {
		fmt.Fprintf(&b, "line %03d", i)
		if i < defaultReadWindowLines {
			b.WriteString("\n")
		}
	}
	if err := os.WriteFile(path, []byte(b.String()), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Read{}).Execute(map[string]any{"path": path})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(result, "Large file") || !strings.Contains(result, "100: line 100") {
		t.Fatalf("expected exact default window file body, got %q", result)
	}
}

func TestReadMissingFileAndInvalidLineLimits(t *testing.T) {
	_, err := (&Read{}).Execute(map[string]any{"path": filepath.Join(t.TempDir(), "missing.txt")})
	if err == nil || !strings.Contains(err.Error(), "read failed") {
		t.Fatalf("expected missing file read failure, got %v", err)
	}
	badCases := []struct {
		offset string
		limit  string
		want   string
	}{
		{offset: "bad", limit: "", want: "invalid offset"},
		{offset: "1", limit: "2-3", want: "with offset"},
		{offset: "", limit: "0-2", want: "positive"},
		{offset: "", limit: "99-100", want: "after end"},
	}
	for _, tc := range badCases {
		_, _, _, err := parseLineLimit(tc.offset, tc.limit, 3)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatalf("parseLineLimit(%q,%q) expected %q error, got %v", tc.offset, tc.limit, tc.want, err)
		}
	}
}

func TestRenderReadFileStringContent(t *testing.T) {
	result, err := RenderReadFile("virtual.txt", "one\ntwo\nthree", "2", "1")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Lines: 3 total, showing 2-2") || !strings.Contains(result, "2: two") || strings.Contains(result, "1: one") {
		t.Fatalf("unexpected string content render: %q", result)
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
	if !strings.Contains(result, "Lines: 4 total, showing 2-3") || !strings.Contains(result, "Next: continue with offset \"4\" and limit \"1\".") || !strings.Contains(result, "2: two\n3: three") || strings.Contains(result, "1: one") || strings.Contains(result, "Hint:") {
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

func TestWriteExecuteReturnIncludesDiffDisplayForCreateAndOverwrite(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	ret, err := (&Write{}).ExecuteReturn(map[string]any{"path": path, "content": "one\ntwo\n"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ret.ModelText, "wrote") || len(ret.Display) != 1 || ret.Display[0].Type != display.BlockDiff {
		t.Fatalf("expected create diff display, got %+v", ret)
	}
	var payload display.DiffBlock
	if err := json.Unmarshal(ret.Display[0].Data, &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(payload.Diff, "--- a/") || !strings.Contains(payload.Diff, "+one") {
		t.Fatalf("unexpected create diff: %s", payload.Diff)
	}
	ret, err = (&Write{}).ExecuteReturn(map[string]any{"path": path, "content": "one\nTWO\n"})
	if err != nil {
		t.Fatal(err)
	}
	if len(ret.Display) != 1 {
		t.Fatalf("expected overwrite diff display, got %+v", ret)
	}
	if err := json.Unmarshal(ret.Display[0].Data, &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(payload.Diff, "-two") || !strings.Contains(payload.Diff, "+TWO") || !strings.Contains(payload.Diff, "@@") {
		t.Fatalf("expected hunk diff for overwrite, got %s", payload.Diff)
	}
}

func TestWriteFileRejectsMissingParent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "out.txt")
	_, err := (&Write{}).Execute(map[string]any{"path": path, "content": "data"})
	if err == nil || !strings.Contains(err.Error(), "create_dirs=true") {
		t.Fatalf("expected parent directory error, got %v", err)
	}
}

func TestWriteFileCreateDirs(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "nested", "out.txt")
	result, err := (&Write{}).Execute(map[string]any{"path": path, "content": "created", "create_dirs": true})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "created" || !strings.Contains(result, "wrote") {
		t.Fatalf("expected nested file creation, data=%q result=%q err=%v", data, result, err)
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

func TestWriteFileRejectsOverwritingDirectory(t *testing.T) {
	dir := t.TempDir()
	_, err := (&Write{}).Execute(map[string]any{"path": dir, "content": "data"})
	if err == nil || !strings.Contains(err.Error(), "overwrite directory") {
		t.Fatalf("expected directory overwrite rejection, got %v", err)
	}
}

func TestWriteFileUsesInjectedGuardBeforeWriting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "blocked.txt")
	guardErr := fmt.Errorf("blocked by policy")
	_, err := (&Write{Guard: func(got string) error {
		if got != path {
			t.Fatalf("guard saw path %q want %q", got, path)
		}
		return guardErr
	}}).Execute(map[string]any{"path": path, "content": "data"})
	if err != guardErr {
		t.Fatalf("expected guard error, got %v", err)
	}
	if _, statErr := os.Stat(path); !os.IsNotExist(statErr) {
		t.Fatalf("guarded write should not create file, stat=%v", statErr)
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
	if !strings.Contains(ret.ModelText, "1 replacements") || len(ret.Display) != 1 || ret.Display[0].Type != display.BlockDiff {
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
	if !strings.Contains(ret.ModelText, "1 replacements") {
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
	if !strings.Contains(ret.ModelText, "3 replacements") {
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
	if !strings.Contains(ret.ModelText, "2 replacements") || len(ret.Display) != 1 {
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

func TestEditUsesInjectedGuardBeforeReadingOrWriting(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing.txt")
	guardErr := fmt.Errorf("blocked by policy")
	ret, err := (&Edit{Guard: func(got string) error {
		if got != path {
			t.Fatalf("guard saw path %q want %q", got, path)
		}
		return guardErr
	}}).ExecuteReturn(map[string]any{"path": path, "old_string": "a", "new_string": "b"})
	if err != guardErr || !ret.IsError {
		t.Fatalf("expected guard error return, ret=%+v err=%v", ret, err)
	}
}

func TestEditBatchRejectsInvalidEdits(t *testing.T) {
	_, err := (&Edit{}).ExecuteReturn(map[string]any{"path": "x", "edits": []any{map[string]any{"new_string": "x"}}})
	if err == nil || !strings.Contains(err.Error(), "old_string required") {
		t.Fatalf("expected old_string validation error, got %v", err)
	}
	_, err = (&Edit{}).ExecuteReturn(map[string]any{"path": "x", "edits": "bad"})
	if err == nil || !strings.Contains(err.Error(), "edits must be an array") {
		t.Fatalf("expected edits array validation error, got %v", err)
	}
}

func TestEditReplaceAllNoMatchAndReplacementDiff(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nomatch.txt")
	if err := os.WriteFile(path, []byte("alpha beta"), 0644); err != nil {
		t.Fatal(err)
	}
	ret, err := (&Edit{}).ExecuteReturn(map[string]any{"path": path, "old_string": "missing", "new_string": "x", "replace_all": true})
	if err == nil || !ret.IsError || !strings.Contains(err.Error(), "old_string not found") {
		t.Fatalf("expected replace_all no-match error, ret=%+v err=%v", ret, err)
	}
	data, readErr := os.ReadFile(path)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(data) != "alpha beta" {
		t.Fatalf("no-match edit should not modify file, got %q", data)
	}
	diff := replacementDiff("file.txt", "old\nline", "new\nline")
	for _, want := range []string{"--- a/file.txt", "+++ b/file.txt", "-old", "+new"} {
		if !strings.Contains(diff, want) {
			t.Fatalf("expected diff to contain %q, got %q", want, diff)
		}
	}
}

func TestEditRejectsBinaryFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bin.dat")
	if err := os.WriteFile(path, []byte{'a', 0, 'b'}, 0644); err != nil {
		t.Fatal(err)
	}
	_, err := (&Edit{}).ExecuteReturn(map[string]any{"path": path, "old_string": "a", "new_string": "b"})
	if err == nil || !strings.Contains(err.Error(), "binary file") {
		t.Fatalf("expected binary edit rejection, got %v", err)
	}
}

func TestGrepAndGlobUseInjectedGuard(t *testing.T) {
	guardErr := fmt.Errorf("blocked by policy")
	guard := PathGuardFunc(func(path string) error {
		if path == "" {
			t.Fatal("guard path should not be empty")
		}
		return guardErr
	})
	_, err := (&Grep{Guard: guard}).Execute(map[string]any{"pattern": "x", "path": t.TempDir()})
	if err != guardErr {
		t.Fatalf("expected grep guard error, got %v", err)
	}
	_, err = (&Glob{Guard: guard}).Execute(map[string]any{"pattern": "**/*.go", "path": t.TempDir()})
	if err != guardErr {
		t.Fatalf("expected glob guard error, got %v", err)
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
	if !strings.Contains(result, "no matches found") {
		t.Errorf("expected 'no matches found', got %s", result)
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

func TestGrepWithGlobAlias(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.go"), []byte("match go"), 0644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("match text"), 0644)

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "match", "path": dir, "glob": "*.go"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "a.go") || strings.Contains(result, "b.txt") {
		t.Fatalf("expected glob alias to filter .go files, got %q", result)
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

func TestGrepIgnoreCase(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "case.txt"), []byte("Alpha\nbeta\n"), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "alpha", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "no matches found") {
		t.Fatalf("expected case-sensitive search to miss, got %q", result)
	}

	result, err = (&Grep{}).Execute(map[string]any{"pattern": "alpha", "path": dir, "ignore_case": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Alpha") {
		t.Fatalf("expected ignore_case search to match, got %q", result)
	}
}

func TestGrepContext(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "ctx.txt")
	if err := os.WriteFile(path, []byte("one\ntwo\nmatch\nfour\nfive\n"), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "match", "path": dir, "before_context": float64(1), "after_context": float64(1)})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"ctx.txt-2- two", "ctx.txt:3: match", "ctx.txt-4- four"} {
		if !strings.Contains(result, want) {
			t.Fatalf("expected context output to contain %q, got %q", want, result)
		}
	}
	if strings.Contains(result, "1- one") || strings.Contains(result, "5- five") {
		t.Fatalf("unexpected context output: %q", result)
	}
}

func TestGrepContextShorthand(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ctx.txt"), []byte("one\nmatch\nthree\n"), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "match", "path": dir, "context": float64(1)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "ctx.txt-1- one") || !strings.Contains(result, "ctx.txt-3- three") {
		t.Fatalf("expected context shorthand output, got %q", result)
	}
}

func TestGrepOutputModeFiles(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("match\nmatch\n"), 0644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("match\n"), 0644)

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "match", "path": dir, "output_mode": "files"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(result, ".txt") != 2 || strings.Contains(result, ":1:") {
		t.Fatalf("expected files output mode, got %q", result)
	}
}

func TestGrepOutputModeCount(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("match\nmatch\n"), 0644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("match\n"), 0644)

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "match", "path": dir, "output_mode": "count"})
	if err != nil {
		t.Fatal(err)
	}
	if result != "3" {
		t.Fatalf("expected count output mode to return 3, got %q", result)
	}
}

func TestGrepRejectsInvalidOutputMode(t *testing.T) {
	_, err := (&Grep{}).Execute(map[string]any{"pattern": "x", "output_mode": "bad"})
	if err == nil || !strings.Contains(err.Error(), "output_mode") {
		t.Fatalf("expected output_mode validation error, got %v", err)
	}
}

func TestGrepRejectsInvalidContext(t *testing.T) {
	_, err := (&Grep{}).Execute(map[string]any{"pattern": "x", "context": float64(101)})
	if err == nil || !strings.Contains(err.Error(), "context") {
		t.Fatalf("expected context validation error, got %v", err)
	}
}

func TestGrepRejectsInvalidHeadLimit(t *testing.T) {
	_, err := (&Grep{}).Execute(map[string]any{"pattern": "x", "head_limit": float64(0)})
	if err == nil || !strings.Contains(err.Error(), "head_limit") {
		t.Fatalf("expected head_limit validation error, got %v", err)
	}
}

func TestGrepRejectsInvalidRegexAndScanMissingFile(t *testing.T) {
	_, err := (&Grep{}).Execute(map[string]any{"pattern": "[", "path": t.TempDir()})
	if err == nil || !strings.Contains(err.Error(), "正则编译失败") {
		t.Fatalf("expected invalid regex error, got %v", err)
	}
	_, err = scanTextFileLines(filepath.Join(t.TempDir(), "missing.txt"))
	if err == nil {
		t.Fatal("expected scanTextFileLines missing file error")
	}
}

func TestGrepUsesRgBackendAndMapsArguments(t *testing.T) {
	oldLookPath := rgLookPath
	t.Cleanup(func() { rgLookPath = oldLookPath })
	dir := t.TempDir()
	argsPath := filepath.Join(dir, "args.txt")
	fakeRG := filepath.Join(dir, "rg")
	script := fmt.Sprintf("#!/bin/sh\nprintf '%%s\n' \"$@\" > %q\nprintf '%%s\n' '{\"type\":\"match\",\"data\":{\"path\":{\"text\":\"fake.go\"},\"lines\":{\"text\":\"fake\\n\"},\"line_number\":1}}'\n", argsPath)
	if err := os.WriteFile(fakeRG, []byte(script), 0755); err != nil {
		t.Fatal(err)
	}
	rgLookPath = func(string) (string, error) { return fakeRG, nil }

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "fake", "path": dir, "glob": "**/*.go", "type": "go", "ignore_case": true, "multiline": true, "include_ignored": true, "hidden": true, "before_context": float64(1), "after_context": float64(2)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "fake.go:1: fake") {
		t.Fatalf("expected normalized rg output, got %q", result)
	}
	args, err := os.ReadFile(argsPath)
	if err != nil {
		t.Fatal(err)
	}
	argText := string(args)
	for _, want := range []string{"--json", "--max-filesize", "10M", "--ignore-case", "--glob", "**/*.go", "--type", "go", "--multiline", "--multiline-dotall", "--no-ignore", "--hidden", "--before-context", "1", "--after-context", "2"} {
		if !strings.Contains(argText, want) {
			t.Fatalf("expected rg args to contain %q, got %q", want, argText)
		}
	}
}

func TestParseRGJSONContentHandlesColonPathContextAndLimit(t *testing.T) {
	jsonLines := strings.Join([]string{
		`{"type":"context","data":{"path":{"text":"dir/file:name.txt"},"lines":{"text":"before\n"},"line_number":1}}`,
		`{"type":"match","data":{"path":{"text":"dir/file:name.txt"},"lines":{"text":"needle\n"},"line_number":2}}`,
		`{"type":"match","data":{"path":{"text":"dir/file:name.txt"},"lines":{"text":"needle again\n"},"line_number":3}}`,
	}, "\n")
	result, err := parseRGJSONContent(jsonLines, 1)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"dir/file:name.txt-1- before", "dir/file:name.txt:2: needle", "[grep results truncated at 1 matches]"} {
		if !strings.Contains(result, want) {
			t.Fatalf("expected rg json result to contain %q, got %q", want, result)
		}
	}
	if strings.Contains(result, "needle again") {
		t.Fatalf("expected head_limit truncation before second match, got %q", result)
	}
}

func TestGrepFallbackRespectsGitignoreHiddenTypeAndMultiline(t *testing.T) {
	oldLookPath := rgLookPath
	t.Cleanup(func() { rgLookPath = oldLookPath })
	rgLookPath = func(string) (string, error) { return "", os.ErrNotExist }
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("ignored.txt\n"), 0644); err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"visible.go":  "alpha\nbeta\n",
		"ignored.txt": "alpha\n",
		".hidden.go":  "alpha\n",
		"note.md":     "alpha\n",
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}

	result, err := (&Grep{}).Execute(map[string]any{"pattern": "alpha", "path": dir, "type": "go"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "visible.go") || strings.Contains(result, "ignored.txt") || strings.Contains(result, ".hidden.go") || strings.Contains(result, "note.md") {
		t.Fatalf("expected fallback grep to respect ignore/hidden/type, got %q", result)
	}

	result, err = (&Grep{}).Execute(map[string]any{"pattern": "alpha", "path": dir, "include_ignored": true, "hidden": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "ignored.txt") || !strings.Contains(result, ".hidden.go") {
		t.Fatalf("expected include_ignored+hidden grep to include ignored and hidden files, got %q", result)
	}

	result, err = (&Grep{}).Execute(map[string]any{"pattern": "alpha\nbeta", "path": dir, "multiline": true, "type": "go"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "visible.go: multiline match") {
		t.Fatalf("expected multiline fallback match, got %q", result)
	}
}

func TestGrepFallbackSkipsBinaryAndLargeFiles(t *testing.T) {
	oldLookPath := rgLookPath
	t.Cleanup(func() { rgLookPath = oldLookPath })
	rgLookPath = func(string) (string, error) { return "", os.ErrNotExist }
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "small.txt"), []byte("needle\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "binary.txt"), []byte{'n', 'e', 'e', 'd', 'l', 'e', 0, '\n'}, 0644); err != nil {
		t.Fatal(err)
	}
	large := strings.Repeat("x", maxGrepScannerFileBytes+1) + "needle\n"
	if err := os.WriteFile(filepath.Join(dir, "large.txt"), []byte(large), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Grep{}).Execute(map[string]any{"pattern": "needle", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "small.txt") || strings.Contains(result, "binary.txt") || strings.Contains(result, "large.txt:1") || !strings.Contains(result, "[skipped") {
		t.Fatalf("expected fallback grep to skip binary/large files, got %q", result)
	}
}

func TestGrepFallbackTypeMappings(t *testing.T) {
	oldLookPath := rgLookPath
	t.Cleanup(func() { rgLookPath = oldLookPath })
	rgLookPath = func(string) (string, error) { return "", os.ErrNotExist }
	dir := t.TempDir()
	files := map[string]string{
		"main.rs":         "needle\n",
		"Dockerfile":      "needle\n",
		"style.scss":      "needle\n",
		"schema.proto":    "needle\n",
		"unrelated.go":    "needle\n",
		"script.bash":     "needle\n",
		"component.swift": "needle\n",
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	cases := []struct{ typ, want string }{{"rust", "main.rs"}, {"dockerfile", "Dockerfile"}, {"scss", "style.scss"}, {"protobuf", "schema.proto"}, {"bash", "script.bash"}, {"swift", "component.swift"}}
	for _, tc := range cases {
		result, err := (&Grep{}).Execute(map[string]any{"pattern": "needle", "path": dir, "type": tc.typ})
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(result, tc.want) || strings.Contains(result, "unrelated.go") {
			t.Fatalf("type %s expected %s only, got %q", tc.typ, tc.want, result)
		}
	}
}

func TestGrepLargeRepoOutputSmoke(t *testing.T) {
	oldLookPath := rgLookPath
	t.Cleanup(func() { rgLookPath = oldLookPath })
	rgLookPath = func(string) (string, error) { return "", os.ErrNotExist }
	dir := t.TempDir()
	for i := 0; i < 120; i++ {
		sub := filepath.Join(dir, fmt.Sprintf("pkg%03d", i))
		if err := os.MkdirAll(sub, 0755); err != nil {
			t.Fatal(err)
		}
		for j := 0; j < 5; j++ {
			content := fmt.Sprintf("package p\n// needle %d %d\n", i, j)
			if err := os.WriteFile(filepath.Join(sub, fmt.Sprintf("file%d.go", j)), []byte(content), 0644); err != nil {
				t.Fatal(err)
			}
		}
	}
	start := time.Now()
	result, err := (&Grep{}).Execute(map[string]any{"pattern": "needle", "path": dir, "type": "go", "head_limit": float64(7)})
	if err != nil {
		t.Fatal(err)
	}
	if time.Since(start) > 5*time.Second {
		t.Fatalf("large repo grep smoke took too long: %s", time.Since(start))
	}
	if strings.Count(result, "needle") != 7 || !strings.Contains(result, "[grep results truncated at 7 matches]") || len(result) > 5000 {
		t.Fatalf("expected bounded large repo output, len=%d result=%q", len(result), result)
	}
}

func TestParseIntArgSupportsInt64(t *testing.T) {
	got, err := parseIntArg(map[string]any{"limit": int64(7)}, "limit", 0, 0, 10)
	if err != nil || got != 7 {
		t.Fatalf("expected int64 parse result 7, got %d err=%v", got, err)
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

func TestGlobAbsolutePattern(t *testing.T) {
	dir := t.TempDir()
	outsideDir := t.TempDir()
	for _, rel := range []string{"a.go", "b.go", "sub/c.go"} {
		path := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(rel), 0644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(outsideDir, "outside.go"), []byte("outside"), 0644); err != nil {
		t.Fatal(err)
	}

	guard := PathGuardFunc(func(path string) error {
		clean := filepath.Clean(path)
		rel, err := filepath.Rel(dir, clean)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return fmt.Errorf("path is outside allowed workspace roots: %s", path)
		}
		return nil
	})
	g := &Glob{Guard: guard}

	result, err := g.Execute(map[string]any{"pattern": filepath.Join(dir, "*.go"), "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "a.go") || !strings.Contains(result, "b.go") || strings.Contains(result, "sub") || strings.Contains(result, "c.go") {
		t.Fatalf("expected absolute pattern to match root go files only, got %q", result)
	}

	result, err = g.Execute(map[string]any{"pattern": "*.go", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "a.go") || !strings.Contains(result, "b.go") || !strings.Contains(result, "sub") || !strings.Contains(result, "c.go") {
		t.Fatalf("expected relative pattern to preserve basename matching behavior, got %q", result)
	}

	result, err = g.Execute(map[string]any{"pattern": "*.missing", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if result != "no matching files found" {
		t.Fatalf("expected no-match message, got %q", result)
	}

	_, err = g.Execute(map[string]any{"pattern": filepath.Join(outsideDir, "*.go"), "path": dir})
	if err == nil || !strings.Contains(err.Error(), "outside allowed workspace") {
		t.Fatalf("expected guarded absolute pattern outside workspace to fail clearly, got %v", err)
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

func TestGlobDoubleStarComplexPatterns(t *testing.T) {
	dir := t.TempDir()
	paths := []string{
		"a/b/c/target.txt",
		"a/x/b/y/c/file.go",
		"root.go",
	}
	for _, rel := range paths {
		path := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(rel), 0644); err != nil {
			t.Fatal(err)
		}
	}

	result, err := (&Glob{}).Execute(map[string]any{"pattern": "a/**/target.txt", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "target.txt") {
		t.Fatalf("expected middle ** match, got %q", result)
	}
	result, err = (&Glob{}).Execute(map[string]any{"pattern": "a/**/b/**/c/*.go", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "file.go") {
		t.Fatalf("expected multiple ** match, got %q", result)
	}
	result, err = (&Glob{}).Execute(map[string]any{"pattern": "**/*.go", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "root.go") || !strings.Contains(result, "file.go") {
		t.Fatalf("expected **/*.go to match root and deep go files, got %q", result)
	}
}

func TestGlobRespectsGitignoreHiddenAndIncludeIgnored(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("ignored/\n!important.txt\n/root-only.txt\n"), 0644); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{"visible.txt", "ignored/drop.txt", "important.txt", "root-only.txt", ".hidden/secret.txt"} {
		path := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(rel), 0644); err != nil {
			t.Fatal(err)
		}
	}

	result, err := (&Glob{}).Execute(map[string]any{"pattern": "**/*.txt", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "visible.txt") || !strings.Contains(result, "important.txt") || strings.Contains(result, "drop.txt") || strings.Contains(result, "root-only.txt") || strings.Contains(result, "secret.txt") {
		t.Fatalf("expected glob to respect gitignore and hidden defaults, got %q", result)
	}

	result, err = (&Glob{}).Execute(map[string]any{"pattern": "**/*.txt", "path": dir, "include_ignored": true, "hidden": true})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"drop.txt", "root-only.txt", "secret.txt"} {
		if !strings.Contains(result, want) {
			t.Fatalf("expected include_ignored+hidden glob to contain %q, got %q", want, result)
		}
	}
}

func TestGlobGitignoreReincludeScope(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("*.txt\n!root-keep.txt\n"), 0644); err != nil {
		t.Fatal(err)
	}
	child := filepath.Join(dir, "child")
	if err := os.MkdirAll(child, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(child, ".gitignore"), []byte("!child-keep.txt\n"), 0644); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{"root-drop.txt", "root-keep.txt", "child/child-keep.txt"} {
		if err := os.WriteFile(filepath.Join(dir, rel), []byte(rel), 0644); err != nil {
			t.Fatal(err)
		}
	}
	result, err := (&Glob{}).Execute(map[string]any{"pattern": "**/*.txt", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "root-keep.txt") || strings.Contains(result, "root-drop.txt") || strings.Contains(result, "child-keep.txt") {
		t.Fatalf("expected negation to apply only within same .gitignore scope, got %q", result)
	}

	if err := os.WriteFile(filepath.Join(child, ".gitignore"), []byte("*.md\n!child-keep.md\n"), 0644); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{"child/child-drop.md", "child/child-keep.md"} {
		if err := os.WriteFile(filepath.Join(dir, rel), []byte(rel), 0644); err != nil {
			t.Fatal(err)
		}
	}
	result, err = (&Glob{}).Execute(map[string]any{"pattern": "**/*.md", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "child-keep.md") || strings.Contains(result, "child-drop.md") {
		t.Fatalf("expected same-scope negation reinclude, got %q", result)
	}
}

func TestGlobLimitOffsetAndSort(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"c.go", "a.go", "b.go"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(name), 0644); err != nil {
			t.Fatal(err)
		}
	}

	result, err := (&Glob{}).Execute(map[string]any{"pattern": "*.go", "path": dir, "limit": float64(1), "offset": float64(1)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "b.go") || strings.Contains(result, "a.go") || strings.Contains(result, "c.go") || !strings.Contains(result, "[glob results showing 2-2 of 3]") {
		t.Fatalf("unexpected paginated glob result: %q", result)
	}
}

func TestGlobRejectsInvalidLimit(t *testing.T) {
	_, err := (&Glob{}).Execute(map[string]any{"pattern": "*.go", "limit": float64(-1)})
	if err == nil || !strings.Contains(err.Error(), "limit") {
		t.Fatalf("expected limit validation error, got %v", err)
	}
}

func TestWriteFileFullPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	result, err := (&Write{}).Execute(map[string]any{"path": path, "content": "data"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, path) {
		t.Fatalf("expected full path in output, got %q", result)
	}
}

func TestWriteFileCreateOnly(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	_, err := (&Write{}).Execute(map[string]any{"path": path, "content": "first"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = (&Write{}).Execute(map[string]any{"path": path, "content": "second", "create_only": true})
	if err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("expected create_only error, got %v", err)
	}
}

func TestWriteFileBackup(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	if err := os.WriteFile(path, []byte("original"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Write{}).Execute(map[string]any{"path": path, "content": "modified", "backup": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, path) {
		t.Fatalf("expected path in output, got %q", result)
	}
	backupData, err := os.ReadFile(path + ".bak")
	if err != nil {
		t.Fatalf("backup not created: %v", err)
	}
	if string(backupData) != "original" {
		t.Fatalf("backup has wrong content: %q", backupData)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "modified" {
		t.Fatalf("modified file has wrong content: %q", data)
	}
}

func TestWriteFileBackupKeepsOverwriteDiff(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	if err := os.WriteFile(path, []byte("original\n"), 0644); err != nil {
		t.Fatal(err)
	}
	ret, err := (&Write{}).ExecuteReturn(map[string]any{"path": path, "content": "modified\n", "backup": true})
	if err != nil {
		t.Fatal(err)
	}
	if len(ret.Display) != 1 || ret.Display[0].Type != display.BlockDiff {
		t.Fatalf("expected diff display block, got %+v", ret.Display)
	}
	var diff display.DiffBlock
	if err := json.Unmarshal(ret.Display[0].Data, &diff); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(diff.Diff, "-original") || !strings.Contains(diff.Diff, "+modified") {
		t.Fatalf("expected backup write diff to compare against original content, got %q", diff.Diff)
	}
}

func TestWriteFileBackupOnCreate(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "new.txt")
	result, err := (&Write{}).Execute(map[string]any{"path": path, "content": "new", "backup": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, path) {
		t.Fatalf("expected path in output, got %q", result)
	}
	// backup should not be created since file didn't exist
	if _, statErr := os.Stat(path + ".bak"); !os.IsNotExist(statErr) {
		t.Fatalf("backup should not exist for new file, stat=%v", statErr)
	}
}

func TestWriteFileDryRun(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "out.txt")
	result, err := (&Write{}).Execute(map[string]any{"path": path, "content": "should-not-write", "dry_run": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "[dry_run]") {
		t.Fatalf("expected dry_run marker, got %q", result)
	}
	if _, statErr := os.Stat(path); !os.IsNotExist(statErr) {
		t.Fatalf("dry_run should not create file, stat=%v", statErr)
	}
}

func TestEditMultipleExactMatchWarning(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "multi.txt")
	if err := os.WriteFile(path, []byte("foo foo foo"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Edit{}).Execute(map[string]any{"path": path, "old_string": "foo", "new_string": "bar"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "warning") || !strings.Contains(result, "3 matches") {
		t.Fatalf("expected warning about multiple matches, got %q", result)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "bar foo foo" {
		t.Fatalf("expected only first replaced, got %q", data)
	}
}

func TestEditReplaceAllNoWarning(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "allmulti.txt")
	if err := os.WriteFile(path, []byte("foo foo foo"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Edit{}).Execute(map[string]any{"path": path, "old_string": "foo", "new_string": "bar", "replace_all": true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(result, "warning") {
		t.Fatalf("expected no warning with replace_all, got %q", result)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "bar bar bar" {
		t.Fatalf("expected all replaced, got %q", data)
	}
}

func TestEditRegexAutoMultiline(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "multiline.txt")
	if err := os.WriteFile(path, []byte("line1\nline2\nline3"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Edit{}).Execute(map[string]any{"path": path, "old_string": "^line", "new_string": "LINE", "regex": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "1 regex replacements") || !strings.Contains(result, "warning") {
		t.Fatalf("expected 1 regex replacement with warning, got %q", result)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "LINE1\nline2\nline3" {
		t.Fatalf("expected only first line replaced, got %q", data)
	}
}

func TestEditRegexRespectsReplaceAll(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "allregex.txt")
	if err := os.WriteFile(path, []byte("line1\nline2\nline3"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Edit{}).Execute(map[string]any{"path": path, "old_string": "^line", "new_string": "LINE", "regex": true, "replace_all": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "3 regex replacements") || strings.Contains(result, "warning") {
		t.Fatalf("expected 3 regex replacements without warning, got %q", result)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "LINE1\nLINE2\nLINE3" {
		t.Fatalf("expected all lines replaced, got %q", data)
	}
}

func TestEditRegexNoAnchorsDoesNotAutoMultiline(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "simple.txt")
	if err := os.WriteFile(path, []byte("foo\nfoo\nfoo"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Edit{}).Execute(map[string]any{"path": path, "old_string": "foo", "new_string": "bar", "regex": true, "replace_all": true})
	if err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "bar\nbar\nbar" {
		t.Fatalf("expected all foos replaced, got %q", data)
	}
	if strings.Contains(result, "warning") {
		t.Fatalf("unexpected warning, got %q", result)
	}
}

func TestReadFileMetadataIncludesSize(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "meta.txt")
	os.WriteFile(path, []byte("hello world"), 0644)
	result, err := (&Read{}).Execute(map[string]any{"path": path, "limit": "all"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "bytes") || !strings.Contains(result, "11 bytes") {
		t.Fatalf("expected file size in metadata, got %q", result)
	}
}

func TestGlobMetadataCount(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"a.go", "b.go", "c.go"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(name), 0644); err != nil {
			t.Fatal(err)
		}
	}
	result, err := (&Glob{}).Execute(map[string]any{"pattern": "*.go", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "[glob results: 3 files]") {
		t.Fatalf("expected glob result count, got %q", result)
	}
}

func TestGlobNoMatchAndOffsetBeyondTotal(t *testing.T) {
	result, err := (&Glob{}).Execute(map[string]any{"pattern": "*.missing", "path": t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "no matching files found") {
		t.Fatalf("expected no match message, got %q", result)
	}
	page, marker := paginateResults([]string{"a", "b"}, 2, 1)
	if page != nil || marker != "" {
		t.Fatalf("expected empty pagination past end, page=%+v marker=%q", page, marker)
	}
}
