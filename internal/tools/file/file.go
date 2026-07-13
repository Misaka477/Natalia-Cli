package file

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/diffutil"
	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/toolreturn"
	"github.com/Misaka477/Natalia-Cli/internal/toolschema"
)

var rgLookPath = exec.LookPath
var rgCommandContext = exec.CommandContext

type Read struct {
	Guard WriteGuard
}

type ReadParams struct {
	Path   string `json:"path" description:"文件绝对路径或相对路径"`
	Offset string `json:"offset,omitempty" description:"可选，起始行号，从 1 开始；例如 '200'"`
	Limit  string `json:"limit,omitempty" description:"可选，读取行数；数字、'start-end' 或 'all'；也接受纯数字"`
}

func (t *Read) Name() string        { return "read_file" }
func (t *Read) Description() string { return "读取文件内容" }
func (t *Read) Parameters() map[string]llm.Property {
	props, _ := toolschema.FromStruct(ReadParams{})
	return props
}
func (t *Read) Required() []string {
	_, required := toolschema.FromStruct(ReadParams{})
	return required
}
func (t *Read) Execute(args map[string]any) (string, error) {
	// Normalize limit from number to string if needed
	if v, ok := args["limit"]; ok {
		if n, ok := v.(float64); ok {
			args["limit"] = fmt.Sprintf("%.0f", n)
		}
	}
	params, err := toolschema.Decode[ReadParams](args)
	if err != nil {
		return "", err
	}
	if t.Guard != nil {
		if err := t.Guard(params.Path); err != nil {
			return "", err
		}
	}
	if binary, err := looksBinaryFile(params.Path); err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	} else if binary {
		return "", fmt.Errorf("refusing to read binary file: %s", params.Path)
	}
	return RenderReadFilePath(params.Path, params.Offset, params.Limit)
}

func RenderReadFilePath(path, offset, limit string) (string, error) {
	totalLines, trailingNewline, err := countFileLines(path)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	start, end, limited, err := parseLineLimit(offset, limit, totalLines)
	if err != nil {
		return "", err
	}
	if !limited && totalLines > defaultReadWindowLines {
		return fmt.Sprintf("File: %s\nLines: %d total\nLarge file: choose a window with offset \"1\" and limit \"100\", request a larger range like offset \"1\" limit \"500\", use legacy limit \"1-500\", or use limit \"all\" to read the whole file.", path, totalLines), nil
	}
	return renderReadFileWindow(path, start, end, totalLines, trailingNewline, limited)
}

const defaultReadWindowLines = 100
const maxReadScannerTokenBytes = 1024 * 1024

func RenderReadFile(path, content, offset, limit string) (string, error) {
	lines := strings.Split(content, "\n")
	if content == "" {
		lines = []string{""}
	}
	start, end, limited, err := parseLineLimit(offset, limit, len(lines))
	if err != nil {
		return "", err
	}
	if !limited && len(lines) > defaultReadWindowLines {
		return fmt.Sprintf("File: %s\nLines: %d total\nLarge file: choose a window with offset \"1\" and limit \"100\", request a larger range like offset \"1\" limit \"500\", use legacy limit \"1-500\", or use limit \"all\" to read the whole file.", path, len(lines)), nil
	}

	var b strings.Builder
	if limited {
		fmt.Fprintf(&b, "File: %s\nLines: %d total, showing %d-%d\n", path, len(lines), start, end)
		if end < len(lines) {
			fmt.Fprintf(&b, "Hint: continue with limit %d-%d or choose a nearby 100-line window.\n", end+1, min(len(lines), end+defaultReadWindowLines))
		}
		b.WriteString("\n")
	}
	for i := start; i <= end; i++ {
		fmt.Fprintf(&b, "%d: %s", i, lines[i-1])
		if i < end {
			b.WriteString("\n")
		}
	}
	return b.String(), nil
}

func countFileLines(path string) (int, bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, false, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), maxReadScannerTokenBytes)
	total := 0
	for scanner.Scan() {
		total++
	}
	if err := scanner.Err(); err != nil {
		return 0, false, err
	}
	info, err := file.Stat()
	if err != nil {
		return 0, false, err
	}
	if info.Size() == 0 {
		return 1, false, nil
	}
	last := []byte{0}
	if _, err := file.ReadAt(last, info.Size()-1); err != nil {
		return 0, false, err
	}
	trailingNewline := last[0] == '\n'
	if trailingNewline {
		total++
	}
	return total, trailingNewline, nil
}

func renderReadFileWindow(path string, start, end, totalLines int, trailingNewline, limited bool) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	defer file.Close()

	var b strings.Builder
	if limited {
		fmt.Fprintf(&b, "File: %s\nLines: %d total, showing %d-%d\n", path, totalLines, start, end)
		if end < totalLines {
			fmt.Fprintf(&b, "Hint: continue with limit %d-%d or choose a nearby 100-line window.\n", end+1, min(totalLines, end+defaultReadWindowLines))
		}
		b.WriteString("\n")
	}

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), maxReadScannerTokenBytes)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		if lineNo < start {
			continue
		}
		if lineNo > end {
			break
		}
		writeNumberedLine(&b, lineNo, scanner.Text(), lineNo < end)
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	if lineNo == 0 && totalLines == 1 && start == 1 && end == 1 {
		writeNumberedLine(&b, 1, "", false)
	}
	if trailingNewline && totalLines >= start && totalLines <= end {
		writeNumberedLine(&b, totalLines, "", false)
	}
	return b.String(), nil
}

func writeNumberedLine(b *strings.Builder, lineNo int, text string, newline bool) {
	fmt.Fprintf(b, "%d: %s", lineNo, text)
	if newline {
		b.WriteString("\n")
	}
}

func looksBinaryFile(path string) (bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer file.Close()
	buf := make([]byte, 8192)
	n, err := file.Read(buf)
	if err != nil && n == 0 {
		return false, nil
	}
	return bytes.IndexByte(buf[:n], 0) >= 0, nil
}

func parseLineLimit(offset, limit string, totalLines int) (int, int, bool, error) {
	if totalLines < 1 {
		totalLines = 1
	}
	offset = strings.TrimSpace(offset)
	limit = strings.TrimSpace(limit)
	if offset == "" && limit == "" {
		return 1, totalLines, false, nil
	}
	if strings.EqualFold(limit, "all") {
		return 1, totalLines, true, nil
	}
	var start, end int
	if offset != "" {
		if _, err := fmt.Sscanf(offset, "%d", &start); err != nil {
			return 0, 0, false, fmt.Errorf("invalid offset %q, expected line number", offset)
		}
		count := defaultReadWindowLines
		if limit != "" {
			if strings.Contains(limit, "-") {
				return 0, 0, false, fmt.Errorf("invalid limit %q with offset, expected line count or all", limit)
			}
			if _, err := fmt.Sscanf(limit, "%d", &count); err != nil {
				return 0, 0, false, fmt.Errorf("invalid limit %q, expected line count", limit)
			}
		}
		end = min(totalLines, start+count-1)
	} else if strings.Contains(limit, "-") {
		if _, err := fmt.Sscanf(limit, "%d-%d", &start, &end); err != nil {
			return 0, 0, false, fmt.Errorf("invalid limit %q, expected start-end", limit)
		}
	} else {
		// Backward compatible shorthand: limit "51" means offset 51 with the default window.
		if _, err := fmt.Sscanf(limit, "%d", &start); err != nil {
			return 0, 0, false, fmt.Errorf("invalid limit %q, expected start-end", limit)
		}
		end = min(totalLines, start+defaultReadWindowLines-1)
	}
	if start < 1 || end < start {
		return 0, 0, false, fmt.Errorf("invalid limit %q, expected positive start-end", limit)
	}
	if start > totalLines {
		return 0, 0, false, fmt.Errorf("limit %q starts after end of file (%d lines)", limit, totalLines)
	}
	if end > totalLines {
		end = totalLines
	}
	return start, end, true, nil
}

type WriteGuard func(path string) error

type Write struct {
	Guard WriteGuard
}

const maxWriteFileBytes = 1024 * 1024

func (t *Write) Name() string        { return "write_file" }
func (t *Write) Description() string { return "写入/覆盖文件" }
func (t *Write) Required() []string  { return []string{"path", "content"} }
func (t *Write) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path":        {Type: "string", Description: "文件绝对路径"},
		"content":     {Type: "string", Description: "文件内容"},
		"create_dirs": {Type: "boolean", Description: "可选，true 时自动创建不存在的父目录；默认 false"},
	}
}
func (t *Write) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Write) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	path, _ := args["path"].(string)
	content, _ := args["content"].(string)
	if path == "" {
		return toolreturn.Return{IsError: true}, fmt.Errorf("path required")
	}
	if t.Guard != nil {
		if err := t.Guard(path); err != nil {
			return toolreturn.Return{IsError: true}, err
		}
	}
	if strings.ContainsRune(content, '\x00') {
		return toolreturn.Return{IsError: true}, fmt.Errorf("refusing to write binary content containing NUL bytes")
	}
	if len(content) > maxWriteFileBytes {
		return toolreturn.Return{IsError: true}, fmt.Errorf("content too large: %d bytes exceeds %d byte limit", len(content), maxWriteFileBytes)
	}
	parent := filepath.Dir(path)
	info, err := os.Stat(parent)
	createDirs, _ := args["create_dirs"].(bool)
	if os.IsNotExist(err) && createDirs {
		if err := os.MkdirAll(parent, 0755); err != nil {
			return toolreturn.Return{IsError: true}, fmt.Errorf("failed to create parent directories: %w", err)
		}
		info, err = os.Stat(parent)
	}
	if err != nil {
		if os.IsNotExist(err) {
			return toolreturn.Return{IsError: true}, fmt.Errorf("parent directory does not exist: %s (set create_dirs=true to auto-create)", parent)
		}
		return toolreturn.Return{IsError: true}, fmt.Errorf("parent directory check failed: %w", err)
	}
	if !info.IsDir() {
		return toolreturn.Return{IsError: true}, fmt.Errorf("parent path is not a directory: %s", parent)
	}
	if info, err := os.Stat(path); err == nil && info.IsDir() {
		return toolreturn.Return{IsError: true}, fmt.Errorf("refusing to overwrite directory: %s", path)
	}
	preview, err := PreviewWrite(args)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("write failed: %w", err)
	}
	modelText := fmt.Sprintf("wrote %s (%d bytes, %d lines)", filepath.Base(path), len(content), countLines(content))
	if preview.Kind == "overwrite" || preview.Kind == "create" {
		block, blockErr := display.NewBlock(display.BlockDiff, filepath.Base(path), display.DiffBlock{Path: path, Diff: preview.Diff})
		if blockErr == nil {
			return toolreturn.Return{ModelText: modelText, Display: []display.Block{block}}, nil
		}
	}
	return toolreturn.Return{ModelText: modelText + "\n" + preview.Summary}, nil
}

func countLines(content string) int {
	if content == "" {
		return 0
	}
	return strings.Count(content, "\n") + 1
}

type Edit struct {
	Guard WriteGuard
}

func (t *Edit) Name() string { return "edit_file" }
func (t *Edit) Description() string {
	return "对文件做精确字符串替换编辑，支持正则匹配和追加"
}
func (t *Edit) Required() []string { return []string{"path", "old_string", "new_string"} }
func (t *Edit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path":        {Type: "string", Description: "文件绝对路径"},
		"old_string":  {Type: "string", Description: "要被替换的字符串；regex=true 时为正则模式；append=true 时忽略"},
		"new_string":  {Type: "string", Description: "替换后的字符串；append=true 时追加此内容到文件末尾"},
		"edits":       {Type: "array", Description: "可选，多编辑批处理数组；每项为 {old_string,new_string}，按顺序应用，全部成功后一次性写入"},
		"replace_all": {Type: "boolean", Description: "可选，是否替换全部匹配；默认 false，只替换第一处"},
		"regex":       {Type: "boolean", Description: "可选，true 时 old_string 为正则模式；默认 false，精确字符串匹配"},
		"append":      {Type: "boolean", Description: "可选，true 时将 new_string 追加到文件末尾，忽略 old_string 和 edits"},
	}
}
func (t *Edit) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Edit) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return toolreturn.Return{IsError: true}, fmt.Errorf("path required")
	}
	appendMode, _ := args["append"].(bool)
	regexMode, _ := args["regex"].(bool)

	if appendMode {
		newStr, _ := args["new_string"].(string)
		if err := t.doAppend(path, newStr); err != nil {
			return toolreturn.Return{IsError: true}, err
		}
		modelText := fmt.Sprintf("appended to %s", path)
		return toolreturn.Return{ModelText: modelText}, nil
	}

	if regexMode {
		return t.doEditRegex(path, args)
	}

	edits, err := parseEditOperations(args)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}
	replaceAll, _ := args["replace_all"].(bool)
	if t.Guard != nil {
		if err := t.Guard(path); err != nil {
			return toolreturn.Return{IsError: true}, err
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("read failed: %w", err)
	}
	if bytes.IndexByte(data, 0) >= 0 {
		return toolreturn.Return{IsError: true}, fmt.Errorf("refusing to edit binary file: %s", path)
	}
	content := string(data)
	newContent := content
	totalReplacements := 0
	for i, edit := range edits {
		matches := strings.Count(newContent, edit.Old)
		if matches == 0 {
			snippet := fileSnippet(content, edit.Old, 80)
			if snippet != "" {
				return toolreturn.Return{IsError: true}, fmt.Errorf(
					"edit %d old_string not found in %s. Closest fragment near line %d: %q",
					i+1, path, snippetLine(content, edit.Old), snippet)
			}
			return toolreturn.Return{IsError: true}, fmt.Errorf("edit %d old_string not found in %s", i+1, path)
		}
		replacements := 1
		if replaceAll {
			replacements = matches
		}
		newContent = strings.Replace(newContent, edit.Old, edit.New, replacements)
		totalReplacements += replacements
	}
	if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("write failed: %w", err)
	}
	modelText := fmt.Sprintf("edited %s — %d replacements", path, totalReplacements)
	block, err := display.NewBlock(display.BlockDiff, filepath.Base(path), display.DiffBlock{Path: path, Diff: replacementDiff(path, content, newContent)})
	if err != nil {
		return toolreturn.Return{ModelText: modelText}, nil
	}
	return toolreturn.Return{ModelText: modelText, Display: []display.Block{block}}, nil
}

func (t *Edit) doAppend(path, newStr string) error {
	if t.Guard != nil {
		if err := t.Guard(path); err != nil {
			return err
		}
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open for append failed: %w", err)
	}
	defer f.Close()
	if _, err := f.WriteString(newStr); err != nil {
		return fmt.Errorf("append failed: %w", err)
	}
	return nil
}

func (t *Edit) doEditRegex(path string, args map[string]any) (toolreturn.Return, error) {
	oldStr, _ := args["old_string"].(string)
	newStr, _ := args["new_string"].(string)
	if oldStr == "" {
		return toolreturn.Return{IsError: true}, fmt.Errorf("old_string required for regex edit")
	}
	re, err := regexp.Compile(oldStr)
	if err != nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("invalid regex %q: %w", oldStr, err)
	}
	if t.Guard != nil {
		if err := t.Guard(path); err != nil {
			return toolreturn.Return{IsError: true}, err
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("read failed: %w", err)
	}
	if bytes.IndexByte(data, 0) >= 0 {
		return toolreturn.Return{IsError: true}, fmt.Errorf("refusing to edit binary file: %s", path)
	}
	content := string(data)
	matches := re.FindAllString(content, -1)
	if len(matches) == 0 {
		return toolreturn.Return{IsError: true}, fmt.Errorf("regex %q matched nothing in %s", oldStr, path)
	}
	replacementCount := len(matches)
	newContent := re.ReplaceAllString(content, newStr)
	if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("write failed: %w", err)
	}
	modelText := fmt.Sprintf("edited %s — %d regex replacements", path, replacementCount)
	block, err := display.NewBlock(display.BlockDiff, filepath.Base(path), display.DiffBlock{Path: path, Diff: replacementDiff(path, content, newContent)})
	if err != nil {
		return toolreturn.Return{ModelText: modelText}, nil
	}
	return toolreturn.Return{ModelText: modelText, Display: []display.Block{block}}, nil
}

type editOperation struct {
	Old string
	New string
}

func parseEditOperations(args map[string]any) ([]editOperation, error) {
	if raw, ok := args["edits"]; ok {
		items, ok := raw.([]any)
		if !ok {
			return nil, fmt.Errorf("edits must be an array")
		}
		if len(items) == 0 {
			return nil, fmt.Errorf("edits must not be empty")
		}
		edits := make([]editOperation, 0, len(items))
		for i, item := range items {
			m, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("edit %d must be an object", i+1)
			}
			oldStr, _ := m["old_string"].(string)
			newStr, _ := m["new_string"].(string)
			if oldStr == "" {
				return nil, fmt.Errorf("edit %d old_string required", i+1)
			}
			edits = append(edits, editOperation{Old: oldStr, New: newStr})
		}
		return edits, nil
	}
	oldStr, _ := args["old_string"].(string)
	newStr, _ := args["new_string"].(string)
	if oldStr == "" {
		return nil, fmt.Errorf("old_string required")
	}
	return []editOperation{{Old: oldStr, New: newStr}}, nil
}

func replacementDiff(path, before, after string) string {
	return diffutil.Unified(path, before, after)
}

type Preview struct {
	Tool    string
	Path    string
	Kind    string
	Summary string
	Diff    string
}

func PreviewWrite(args map[string]any) (Preview, error) {
	path, _ := args["path"].(string)
	content, _ := args["content"].(string)
	if path == "" {
		return Preview{}, fmt.Errorf("path required")
	}
	if strings.ContainsRune(content, '\x00') {
		return Preview{}, fmt.Errorf("refusing to write binary content containing NUL bytes")
	}
	if len(content) > maxWriteFileBytes {
		return Preview{}, fmt.Errorf("content too large: %d bytes exceeds %d byte limit", len(content), maxWriteFileBytes)
	}
	before := ""
	kind := "create"
	if data, err := os.ReadFile(path); err == nil {
		before = string(data)
		kind = "overwrite"
	} else if !os.IsNotExist(err) {
		return Preview{}, fmt.Errorf("read existing file failed: %w", err)
	}
	return Preview{Tool: "write_file", Path: path, Kind: kind, Summary: fmt.Sprintf("write_file %s %s (%d bytes, %d lines)", kind, path, len(content), countLines(content)), Diff: replacementDiff(path, before, content)}, nil
}

func PreviewEdit(args map[string]any) (Preview, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return Preview{}, fmt.Errorf("path required")
	}
	edits, err := parseEditOperations(args)
	if err != nil {
		return Preview{}, err
	}
	replaceAll, _ := args["replace_all"].(bool)
	data, err := os.ReadFile(path)
	if err != nil {
		return Preview{}, fmt.Errorf("read failed: %w", err)
	}
	if bytes.IndexByte(data, 0) >= 0 {
		return Preview{}, fmt.Errorf("refusing to edit binary file: %s", path)
	}
	content := string(data)
	newContent := content
	totalReplacements := 0
	for i, edit := range edits {
		matches := strings.Count(newContent, edit.Old)
		if matches == 0 {
			snippet := fileSnippet(content, edit.Old, 80)
			if snippet != "" {
				return Preview{}, fmt.Errorf(
					"edit %d old_string not found in %s. Closest fragment near line %d: %q",
					i+1, path, snippetLine(content, edit.Old), snippet)
			}
			return Preview{}, fmt.Errorf("edit %d old_string not found in %s", i+1, path)
		}
		replacements := 1
		if replaceAll {
			replacements = matches
		}
		newContent = strings.Replace(newContent, edit.Old, edit.New, replacements)
		totalReplacements += replacements
	}
	return Preview{Tool: "edit_file", Path: path, Kind: "edit", Summary: fmt.Sprintf("edit_file %s (%d replacements)", path, totalReplacements), Diff: replacementDiff(path, content, newContent)}, nil
}

type SearchGuard interface {
	GuardRead(path string) error
}

type PathGuardFunc func(path string) error

func (fn PathGuardFunc) GuardRead(path string) error { return fn(path) }

type Grep struct {
	Guard SearchGuard
}

const maxGrepScannerFileBytes = 10 * 1024 * 1024

func (t *Grep) Name() string { return "grep" }
func (t *Grep) Description() string {
	return "在文件中递归搜索文本（支持正则表达式）"
}
func (t *Grep) Required() []string { return []string{"pattern"} }
func (t *Grep) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"pattern":         {Type: "string", Description: "搜索模式（正则）"},
		"path":            {Type: "string", Description: "可选，搜索目录，默认当前目录"},
		"include":         {Type: "string", Description: "可选，文件 glob 过滤如 '*.go'"},
		"glob":            {Type: "string", Description: "可选，ripgrep 风格文件 glob 过滤；当前作为 include 的别名"},
		"type":            {Type: "string", Description: "可选，按 ripgrep 文件类型过滤，如 go、py、js、md"},
		"multiline":       {Type: "boolean", Description: "可选，启用跨行正则搜索"},
		"include_ignored": {Type: "boolean", Description: "可选，包含 .gitignore 忽略的文件"},
		"hidden":          {Type: "boolean", Description: "可选，包含隐藏文件和隐藏目录"},
		"head_limit":      {Type: "integer", Description: "可选，最多返回多少条匹配，默认 200，范围 1-10000"},
		"ignore_case":     {Type: "boolean", Description: "可选，是否忽略大小写，默认 false"},
		"before_context":  {Type: "integer", Description: "可选，每条匹配前显示多少行上下文，默认 0，范围 0-100"},
		"after_context":   {Type: "integer", Description: "可选，每条匹配后显示多少行上下文，默认 0，范围 0-100"},
		"context":         {Type: "integer", Description: "可选，同时设置 before_context 和 after_context，范围 0-100"},
		"output_mode":     {Type: "string", Description: "可选，content|files|count；默认 content"},
	}
}
func (t *Grep) Execute(args map[string]any) (string, error) {
	opts, err := parseGrepOptions(args)
	if err != nil {
		return "", err
	}
	if t.Guard != nil {
		if err := t.Guard.GuardRead(opts.SearchPath); err != nil {
			return "", err
		}
	}
	if result, ok := grepWithRG(opts); ok {
		return result, nil
	}
	return grepWithScanner(opts)
}

type grepOptions struct {
	Pattern        string
	SearchPath     string
	Include        string
	Type           string
	HeadLimit      int
	IgnoreCase     bool
	Multiline      bool
	IncludeIgnored bool
	Hidden         bool
	BeforeContext  int
	AfterContext   int
	OutputMode     string
}

func parseGrepOptions(args map[string]any) (grepOptions, error) {
	pattern, _ := args["pattern"].(string)
	if pattern == "" {
		return grepOptions{}, fmt.Errorf("pattern 是必填参数")
	}
	searchPath, _ := args["path"].(string)
	if searchPath == "" {
		searchPath = "."
	}
	include, _ := args["include"].(string)
	if include == "" {
		include, _ = args["glob"].(string)
	}
	typeName, _ := args["type"].(string)
	headLimit, err := parsePositiveIntArg(args, "head_limit", 200, 10000)
	if err != nil {
		return grepOptions{}, err
	}
	beforeContext, afterContext, err := parseGrepContextArgs(args)
	if err != nil {
		return grepOptions{}, err
	}
	outputMode, err := parseGrepOutputMode(args)
	if err != nil {
		return grepOptions{}, err
	}
	ignoreCase, _ := args["ignore_case"].(bool)
	multiline, _ := args["multiline"].(bool)
	includeIgnored, _ := args["include_ignored"].(bool)
	hidden, _ := args["hidden"].(bool)
	return grepOptions{Pattern: pattern, SearchPath: searchPath, Include: include, Type: typeName, HeadLimit: headLimit, IgnoreCase: ignoreCase, Multiline: multiline, IncludeIgnored: includeIgnored, Hidden: hidden, BeforeContext: beforeContext, AfterContext: afterContext, OutputMode: outputMode}, nil
}

func grepWithScanner(opts grepOptions) (string, error) {
	compilePattern := opts.Pattern
	if opts.IgnoreCase {
		compilePattern = "(?i)" + opts.Pattern
	}
	re, err := regexp.Compile(compilePattern)
	if err != nil {
		return "", fmt.Errorf("正则编译失败: %w", err)
	}

	var results []string
	matchedFiles := make(map[string]bool)
	matchCount := 0
	truncated := false
	walkErr := walkSearchFiles(opts.SearchPath, searchWalkOptions{IncludeIgnored: opts.IncludeIgnored, Hidden: opts.Hidden}, func(path string, info os.FileInfo) error {
		if truncated {
			return filepath.SkipAll
		}
		if opts.Include != "" {
			rel, _ := filepath.Rel(opts.SearchPath, path)
			matched := matchGlobPattern(opts.Include, filepath.ToSlash(rel))
			if !matched {
				matched = matchGlobPattern(opts.Include, filepath.Base(path))
			}
			if !matched {
				return nil
			}
		}
		if opts.Type != "" && !fileMatchesType(path, opts.Type) {
			return nil
		}
		if skip, reason := skipGrepScannerFile(path, info); skip {
			if opts.OutputMode == "content" && reason != "binary" {
				results = append(results, fmt.Sprintf("[skipped %s: %s]", path, reason))
			}
			return nil
		}
		lines, err := scanTextFileLines(path)
		if err != nil {
			return nil
		}
		if opts.Multiline {
			joined := strings.Join(lines, "\n")
			if re.MatchString(joined) {
				matchedFiles[path] = true
				matchCount++
				if opts.OutputMode == "content" {
					results = append(results, fmt.Sprintf("%s: multiline match", path))
				}
			}
			return nil
		}
		matches := make([]bool, len(lines))
		matchLines := make([]int, 0)
		for i, line := range lines {
			if !re.MatchString(line) {
				continue
			}
			matches[i] = true
			matchedFiles[path] = true
			matchCount++
			if opts.OutputMode == "content" && matchCount > opts.HeadLimit {
				truncated = true
				break
			}
			if opts.OutputMode == "content" {
				matchLines = append(matchLines, i+1)
			}
		}
		emit := make(map[int]bool)
		for _, lineNo := range matchLines {
			start := max(1, lineNo-opts.BeforeContext)
			end := min(len(lines), lineNo+opts.AfterContext)
			for n := start; n <= end; n++ {
				emit[n] = true
			}
		}
		for n := 1; n <= len(lines); n++ {
			if emit[n] {
				results = append(results, formatGrepLine(path, n, lines[n-1], matches[n-1]))
			}
		}
		return nil
	})
	if walkErr != nil {
		return "", walkErr
	}

	if matchCount == 0 {
		return "no matches found", nil
	}
	if opts.OutputMode == "count" {
		return fmt.Sprintf("%d", matchCount), nil
	}
	if opts.OutputMode == "files" {
		files := make([]string, 0, len(matchedFiles))
		for path := range matchedFiles {
			files = append(files, path)
		}
		sort.Strings(files)
		return strings.Join(files, "\n"), nil
	}
	if truncated {
		results = append(results, fmt.Sprintf("[grep results truncated at %d matches]", opts.HeadLimit))
	}
	return strings.Join(results, "\n"), nil
}

func grepWithRG(opts grepOptions) (string, bool) {
	bin, err := rgLookPath("rg")
	if err != nil {
		return "", false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	args := []string{"--color", "never", "--max-filesize", "10M"}
	if opts.OutputMode == "content" {
		args = append(args, "--json")
	} else {
		args = append(args, "--line-number", "--no-heading")
	}
	if opts.IgnoreCase {
		args = append(args, "--ignore-case")
	}
	if opts.Include != "" {
		args = append(args, "--glob", opts.Include)
	}
	if opts.Type != "" {
		args = append(args, "--type", opts.Type)
	}
	if opts.Multiline {
		args = append(args, "--multiline", "--multiline-dotall")
	}
	if opts.IncludeIgnored {
		args = append(args, "--no-ignore")
	}
	if opts.Hidden {
		args = append(args, "--hidden")
	}
	if opts.BeforeContext > 0 {
		args = append(args, "--before-context", strconv.Itoa(opts.BeforeContext))
	}
	if opts.AfterContext > 0 {
		args = append(args, "--after-context", strconv.Itoa(opts.AfterContext))
	}
	switch opts.OutputMode {
	case "files":
		args = append(args, "--files-with-matches")
	case "count":
		args = append(args, "--count")
	}
	args = append(args, opts.Pattern, opts.SearchPath)
	out, err := rgCommandContext(ctx, bin, args...).CombinedOutput()
	text := strings.TrimSpace(string(out))
	if err != nil {
		if text == "" {
			if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
				return "no matches found", true
			}
			return "", false
		}
		return "", false
	}
	if text == "" {
		return "no matches found", true
	}
	switch opts.OutputMode {
	case "count":
		return strconv.Itoa(totalRGCount(text)), true
	case "files":
		lines := nonEmptyLines(text)
		sort.Strings(lines)
		return strings.Join(lines, "\n"), true
	default:
		result, err := parseRGJSONContent(text, opts.HeadLimit)
		if err != nil {
			return "", false
		}
		return result, true
	}
}

type rgJSONEvent struct {
	Type string     `json:"type"`
	Data rgJSONData `json:"data"`
}

type rgJSONData struct {
	Path       rgJSONText `json:"path"`
	Lines      rgJSONText `json:"lines"`
	LineNumber int        `json:"line_number"`
}

type rgJSONText struct {
	Text string `json:"text"`
}

func parseRGJSONContent(text string, headLimit int) (string, error) {
	var lines []string
	matchCount := 0
	truncated := false
	for _, raw := range strings.Split(strings.TrimSpace(text), "\n") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		var event rgJSONEvent
		if err := json.Unmarshal([]byte(raw), &event); err != nil {
			return "", err
		}
		if event.Type != "match" && event.Type != "context" {
			continue
		}
		if event.Type == "match" {
			matchCount++
			if headLimit > 0 && matchCount > headLimit {
				truncated = true
				break
			}
		}
		sep := "-"
		if event.Type == "match" {
			sep = ":"
		}
		line := strings.TrimRight(event.Data.Lines.Text, "\r\n")
		lines = append(lines, fmt.Sprintf("%s%s%d%s %s", event.Data.Path.Text, sep, event.Data.LineNumber, sep, line))
	}
	if len(lines) == 0 {
		return "no matches found", nil
	}
	if truncated {
		lines = append(lines, fmt.Sprintf("[grep results truncated at %d matches]", headLimit))
	}
	return strings.Join(lines, "\n"), nil
}

func normalizeRGContent(text string) string {
	lines := nonEmptyLines(text)
	for i, line := range lines {
		lines[i] = normalizeRGLine(line)
	}
	return strings.Join(lines, "\n")
}

func normalizeRGLine(line string) string {
	re := regexp.MustCompile(`^(.+)([:\-])([0-9]+)([:\-])(.*)$`)
	m := re.FindStringSubmatch(line)
	if len(m) != 6 || m[2] != m[4] {
		return line
	}
	return fmt.Sprintf("%s%s%s%s %s", m[1], m[2], m[3], m[4], strings.TrimSpace(m[5]))
}

func totalRGCount(text string) int {
	total := 0
	for _, line := range nonEmptyLines(text) {
		idx := strings.LastIndex(line, ":")
		if idx >= 0 {
			line = line[idx+1:]
		}
		count, err := strconv.Atoi(strings.TrimSpace(line))
		if err == nil {
			total += count
		}
	}
	return total
}

func limitRGContent(text string, headLimit int) string {
	lines := nonEmptyLines(text)
	if headLimit <= 0 {
		return strings.Join(lines, "\n")
	}
	matchCount := 0
	keep := make([]string, 0, min(len(lines), headLimit))
	for _, line := range lines {
		if regexp.MustCompile(`^.+:[0-9]+:`).MatchString(line) {
			matchCount++
		}
		if matchCount > headLimit {
			break
		}
		keep = append(keep, line)
	}
	if matchCount > headLimit {
		keep = append(keep, fmt.Sprintf("[grep results truncated at %d matches]", headLimit))
	}
	return strings.Join(keep, "\n")
}

func nonEmptyLines(text string) []string {
	parts := strings.Split(strings.TrimSpace(text), "\n")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func parseGrepOutputMode(args map[string]any) (string, error) {
	mode, _ := args["output_mode"].(string)
	if mode == "" {
		return "content", nil
	}
	switch mode {
	case "content", "files", "count":
		return mode, nil
	default:
		return "", fmt.Errorf("output_mode must be one of content, files, count")
	}
}

func skipGrepScannerFile(path string, info os.FileInfo) (bool, string) {
	if info != nil && info.Size() > maxGrepScannerFileBytes {
		return true, fmt.Sprintf("file too large (%d bytes > %d bytes)", info.Size(), maxGrepScannerFileBytes)
	}
	binary, err := looksBinaryFile(path)
	if err == nil && binary {
		return true, "binary"
	}
	return false, ""
}

func scanTextFileLines(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), maxReadScannerTokenBytes)
	lines := make([]string, 0)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return lines, nil
}

func formatGrepLine(path string, lineNo int, line string, match bool) string {
	if match {
		return fmt.Sprintf("%s:%d: %s", path, lineNo, strings.TrimSpace(line))
	}
	return fmt.Sprintf("%s-%d- %s", path, lineNo, strings.TrimSpace(line))
}

func parseGrepContextArgs(args map[string]any) (int, int, error) {
	before, err := parseIntArg(args, "before_context", 0, 0, 100)
	if err != nil {
		return 0, 0, err
	}
	after, err := parseIntArg(args, "after_context", 0, 0, 100)
	if err != nil {
		return 0, 0, err
	}
	if _, ok := args["context"]; ok {
		context, err := parseIntArg(args, "context", 0, 0, 100)
		if err != nil {
			return 0, 0, err
		}
		before = context
		after = context
	}
	return before, after, nil
}

func parsePositiveIntArg(args map[string]any, name string, defaultValue, maxValue int) (int, error) {
	return parseIntArg(args, name, defaultValue, 1, maxValue)
}

func parseIntArg(args map[string]any, name string, defaultValue, minValue, maxValue int) (int, error) {
	raw, ok := args[name]
	if !ok || raw == nil {
		return defaultValue, nil
	}
	var value int
	switch v := raw.(type) {
	case int:
		value = v
	case int64:
		value = int(v)
	case float64:
		if v != float64(int(v)) {
			return 0, fmt.Errorf("%s must be an integer", name)
		}
		value = int(v)
	case string:
		if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &value); err != nil {
			return 0, fmt.Errorf("%s must be an integer", name)
		}
	default:
		return 0, fmt.Errorf("%s must be an integer", name)
	}
	if value < minValue || value > maxValue {
		return 0, fmt.Errorf("%s must be between %d and %d", name, minValue, maxValue)
	}
	return value, nil
}

type searchWalkOptions struct {
	IncludeIgnored bool
	Hidden         bool
}

type ignoreRule struct {
	Pattern string
	Negate  bool
	DirOnly bool
	Rooted  bool
	BaseDir string
}

func walkSearchFiles(root string, opts searchWalkOptions, fn func(path string, info os.FileInfo) error) error {
	root = filepath.Clean(root)
	var rules []ignoreRule
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		if path != root {
			if d.IsDir() && d.Name() == ".git" {
				return filepath.SkipDir
			}
			if !opts.Hidden && strings.HasPrefix(d.Name(), ".") {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if !opts.IncludeIgnored && ignoredByRules(root, path, d.IsDir(), rules) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}
		if d.IsDir() {
			if !opts.IncludeIgnored {
				rules = append(rules, readGitignoreRules(path)...)
			}
			return nil
		}
		return fn(path, info)
	})
}

func readGitignoreRules(dir string) []ignoreRule {
	data, err := os.ReadFile(filepath.Join(dir, ".gitignore"))
	if err != nil {
		return nil
	}
	lines := strings.Split(string(data), "\n")
	rules := make([]ignoreRule, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		rule := ignoreRule{BaseDir: dir}
		if strings.HasPrefix(line, "!") {
			rule.Negate = true
			line = strings.TrimPrefix(line, "!")
		}
		if strings.HasPrefix(line, "/") {
			rule.Rooted = true
			line = strings.TrimPrefix(line, "/")
		}
		if strings.HasSuffix(line, "/") {
			rule.DirOnly = true
			line = strings.TrimSuffix(line, "/")
		}
		line = filepath.ToSlash(strings.TrimSpace(line))
		if line != "" {
			rule.Pattern = line
			rules = append(rules, rule)
		}
	}
	return rules
}

func ignoredByRules(root, path string, isDir bool, rules []ignoreRule) bool {
	ignored := false
	ignoredBase := ""
	for _, rule := range rules {
		if rule.DirOnly && !isDir {
			continue
		}
		if ignoreRuleMatches(root, path, rule) {
			if rule.Negate {
				if ignored && rule.BaseDir == ignoredBase {
					ignored = false
					ignoredBase = ""
				}
				continue
			}
			ignored = true
			ignoredBase = rule.BaseDir
		}
	}
	return ignored
}

func ignoreRuleMatches(root, path string, rule ignoreRule) bool {
	base := root
	if rule.BaseDir != "" {
		base = rule.BaseDir
	}
	rel, err := filepath.Rel(base, path)
	if err != nil || strings.HasPrefix(rel, "..") {
		return false
	}
	rel = filepath.ToSlash(rel)
	pattern := rule.Pattern
	if rule.Rooted || strings.Contains(pattern, "/") {
		return matchGlobPattern(pattern, rel)
	}
	parts := strings.Split(rel, "/")
	for _, part := range parts {
		if matchGlobPattern(pattern, part) {
			return true
		}
	}
	return false
}

func matchGlobPattern(pattern, path string) bool {
	pattern = filepath.ToSlash(filepath.Clean(pattern))
	path = filepath.ToSlash(filepath.Clean(path))
	if pattern == "." {
		pattern = ""
	}
	if path == "." {
		path = ""
	}
	return matchGlobParts(splitPathPattern(pattern), splitPathPattern(path))
}

func splitPathPattern(s string) []string {
	s = strings.Trim(s, "/")
	if s == "" {
		return nil
	}
	return strings.Split(s, "/")
}

func matchGlobParts(pattern, path []string) bool {
	if len(pattern) == 0 {
		return len(path) == 0
	}
	if pattern[0] == "**" {
		if matchGlobParts(pattern[1:], path) {
			return true
		}
		return len(path) > 0 && matchGlobParts(pattern, path[1:])
	}
	if len(path) == 0 {
		return false
	}
	matched, err := filepath.Match(pattern[0], path[0])
	if err != nil || !matched {
		return false
	}
	return matchGlobParts(pattern[1:], path[1:])
}

func fileMatchesType(path, typeName string) bool {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(path)), ".")
	base := strings.ToLower(filepath.Base(path))
	switch strings.ToLower(strings.TrimSpace(typeName)) {
	case "go", "golang":
		return ext == "go"
	case "rs", "rust":
		return ext == "rs"
	case "rb", "ruby":
		return ext == "rb"
	case "java":
		return ext == "java"
	case "c":
		return extIn(ext, "c", "h")
	case "c++", "cpp", "cc":
		return extIn(ext, "cc", "cpp", "cxx", "hpp", "hh", "hxx")
	case "cs", "csharp":
		return ext == "cs"
	case "php":
		return ext == "php"
	case "swift":
		return ext == "swift"
	case "kt", "kotlin":
		return ext == "kt" || ext == "kts"
	case "md", "markdown":
		return ext == "md" || ext == "markdown"
	case "js", "javascript":
		return ext == "js" || ext == "jsx" || ext == "mjs" || ext == "cjs"
	case "ts", "typescript":
		return ext == "ts" || ext == "tsx"
	case "py", "python":
		return ext == "py"
	case "json":
		return ext == "json"
	case "yaml", "yml":
		return ext == "yaml" || ext == "yml"
	case "txt", "text":
		return ext == "txt"
	case "sh", "bash", "shell":
		return extIn(ext, "sh", "bash", "zsh", "fish") || base == "bashrc" || base == ".bashrc" || base == ".zshrc"
	case "css", "scss", "less":
		return extIn(ext, "css", "scss", "less")
	case "html", "htm":
		return ext == "html" || ext == "htm"
	case "xml":
		return extIn(ext, "xml", "svg", "plist")
	case "toml":
		return ext == "toml"
	case "docker", "dockerfile":
		return base == "dockerfile" || strings.HasPrefix(base, "dockerfile.")
	case "proto", "protobuf":
		return ext == "proto"
	case "all", "":
		return true
	default:
		return ext == strings.ToLower(strings.TrimSpace(typeName))
	}
}

func extIn(ext string, values ...string) bool {
	for _, value := range values {
		if ext == value {
			return true
		}
	}
	return false
}

type Glob struct {
	Guard SearchGuard
}

func (t *Glob) Name() string { return "glob" }
func (t *Glob) Description() string {
	return "按 glob 模式递归查找文件（支持 ** 匹配任意目录）"
}
func (t *Glob) Required() []string { return []string{"pattern"} }
func (t *Glob) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"pattern":         {Type: "string", Description: "glob 模式如 '**/*.go' 或 'src/**/*.ts'"},
		"path":            {Type: "string", Description: "可选，搜索根目录，默认当前"},
		"include_ignored": {Type: "boolean", Description: "可选，包含 .gitignore 忽略的文件"},
		"hidden":          {Type: "boolean", Description: "可选，包含隐藏文件和隐藏目录"},
		"limit":           {Type: "integer", Description: "可选，最多返回多少条结果；默认返回全部，范围 1-10000"},
		"offset":          {Type: "integer", Description: "可选，从第几条结果开始返回，0-based，默认 0"},
	}
}
func (t *Glob) Execute(args map[string]any) (string, error) {
	pattern, _ := args["pattern"].(string)
	if pattern == "" {
		return "", fmt.Errorf("pattern 是必填参数")
	}
	searchPath, _ := args["path"].(string)
	if searchPath == "" {
		searchPath = "."
	}
	if t.Guard != nil {
		if err := t.Guard.GuardRead(searchPath); err != nil {
			return "", err
		}
	}
	limit, err := parseIntArg(args, "limit", 0, 0, 10000)
	if err != nil {
		return "", err
	}
	offset, err := parseIntArg(args, "offset", 0, 0, 1000000)
	if err != nil {
		return "", err
	}

	includeIgnored, _ := args["include_ignored"].(bool)
	hidden, _ := args["hidden"].(bool)
	var results []string
	if err := walkSearchFiles(searchPath, searchWalkOptions{IncludeIgnored: includeIgnored, Hidden: hidden}, func(path string, info os.FileInfo) error {
		rel, err := filepath.Rel(searchPath, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if matchGlobPattern(pattern, rel) || matchGlobPattern(pattern, filepath.Base(path)) {
			results = append(results, path)
		}
		return nil
	}); err != nil {
		return "", err
	}
	sort.Strings(results)

	if len(results) == 0 {
		return "no matching files found", nil
	}
	results, marker := paginateResults(results, offset, limit)
	if len(results) == 0 {
		return "no matching files found", nil
	}
	if marker != "" {
		results = append(results, marker)
	}
	return strings.Join(results, "\n"), nil
}

func paginateResults(results []string, offset, limit int) ([]string, string) {
	total := len(results)
	if offset >= total {
		return nil, ""
	}
	end := total
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	page := results[offset:end]
	if offset == 0 && end == total {
		return page, ""
	}
	return page, fmt.Sprintf("[glob results showing %d-%d of %d]", offset+1, end, total)
}

// fileSnippet returns a fragment of content surrounding the closest match to needle.
func fileSnippet(content, needle string, radius int) string {
	if len(needle) == 0 || len(content) == 0 {
		return ""
	}
	// Get the first N chars of needle for fuzzy matching
	prefix := needle
	if len([]rune(needle)) > 20 {
		prefix = string([]rune(needle)[:20])
	}
	idx := strings.Index(content, prefix[:1])
	if idx < 0 {
		// Fall back: show beginning of file
		start := 0
		end := radius
		if end > len(content) {
			end = len(content)
		}
		return string([]rune(content[start:end]))
	}
	start := idx - radius/2
	if start < 0 {
		start = 0
	}
	end := idx + radius
	if end > len(content) {
		end = len(content)
	}
	return string([]rune(content[start:end]))
}

func snippetLine(content, needle string) int {
	if len(needle) == 0 || len(content) == 0 {
		return 1
	}
	prefix := string([]rune(needle)[:1])
	idx := strings.Index(content, prefix)
	if idx < 0 {
		return 1
	}
	return strings.Count(content[:idx], "\n") + 1
}
