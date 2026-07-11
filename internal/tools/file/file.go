package file

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/toolschema"
)

type Read struct{}

type ReadParams struct {
	Path   string `json:"path" description:"文件绝对路径或相对路径"`
	Offset string `json:"offset,omitempty" description:"可选，起始行号，从 1 开始；例如 '200'"`
	Limit  string `json:"limit,omitempty" description:"可选，读取行数；也兼容 'start-end' 或 'all'"`
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
	params, err := toolschema.Decode[ReadParams](args)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(params.Path)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	return renderFileRead(params.Path, string(data), params.Offset, params.Limit)
}

const defaultReadWindowLines = 100

func renderFileRead(path, content, offset, limit string) (string, error) {
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

type Write struct{}

func (t *Write) Name() string        { return "write_file" }
func (t *Write) Description() string { return "写入/覆盖文件" }
func (t *Write) Required() []string  { return []string{"path", "content"} }
func (t *Write) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path":    {Type: "string", Description: "文件绝对路径"},
		"content": {Type: "string", Description: "文件内容"},
	}
}
func (t *Write) Execute(args map[string]any) (string, error) {
	path, _ := args["path"].(string)
	content, _ := args["content"].(string)
	if path == "" {
		return "", fmt.Errorf("path required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return "", fmt.Errorf("mkdir failed: %w", err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("write failed: %w", err)
	}
	return fmt.Sprintf("已写入 %s (%d bytes)", path, len(content)), nil
}

type Edit struct{}

func (t *Edit) Name() string        { return "edit_file" }
func (t *Edit) Description() string { return "对文件做精确字符串替换编辑" }
func (t *Edit) Required() []string  { return []string{"path", "old_string", "new_string"} }
func (t *Edit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path":       {Type: "string", Description: "文件绝对路径"},
		"old_string": {Type: "string", Description: "要被替换的字符串（必须精确匹配）"},
		"new_string": {Type: "string", Description: "替换后的字符串"},
	}
}
func (t *Edit) Execute(args map[string]any) (string, error) {
	path, _ := args["path"].(string)
	oldStr, _ := args["old_string"].(string)
	newStr, _ := args["new_string"].(string)
	if path == "" || oldStr == "" {
		return "", fmt.Errorf("path and old_string required")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	content := string(data)
	if !strings.Contains(content, oldStr) {
		return "", fmt.Errorf("old_string not found in %s", path)
	}
	newContent := strings.Replace(content, oldStr, newStr, 1)
	if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
		return "", fmt.Errorf("write failed: %w", err)
	}
	return fmt.Sprintf("已编辑 %s — 替换 1 处", path), nil
}

type Grep struct{}

func (t *Grep) Name() string { return "grep" }
func (t *Grep) Description() string {
	return "在文件中递归搜索文本（支持正则表达式）"
}
func (t *Grep) Required() []string { return []string{"pattern"} }
func (t *Grep) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"pattern": {Type: "string", Description: "搜索模式（正则）"},
		"path":    {Type: "string", Description: "可选，搜索目录，默认当前目录"},
		"include": {Type: "string", Description: "可选，文件 glob 过滤如 '*.go'"},
	}
}
func (t *Grep) Execute(args map[string]any) (string, error) {
	pattern, _ := args["pattern"].(string)
	if pattern == "" {
		return "", fmt.Errorf("pattern 是必填参数")
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return "", fmt.Errorf("正则编译失败: %w", err)
	}

	searchPath, _ := args["path"].(string)
	if searchPath == "" {
		searchPath = "."
	}
	include, _ := args["include"].(string)

	var results []string
	truncated := false
	walkErr := filepath.Walk(searchPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if truncated {
			return filepath.SkipDir
		}
		if info.IsDir() {
			if strings.HasPrefix(info.Name(), ".") && info.Name() != "." {
				return filepath.SkipDir
			}
			return nil
		}
		if include != "" {
			matched, _ := filepath.Match(include, filepath.Base(path))
			if !matched {
				return nil
			}
		}
		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		scanner := bufio.NewScanner(file)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		lineNo := 0
		for scanner.Scan() {
			lineNo++
			line := scanner.Text()
			if re.MatchString(line) {
				results = append(results, fmt.Sprintf("%s:%d: %s", path, lineNo, strings.TrimSpace(line)))
				if len(results) >= 200 {
					truncated = true
					break
				}
			}
		}
		if err := scanner.Err(); err != nil {
			results = append(results, fmt.Sprintf("%s: read error: %v", path, err))
		}
		_ = file.Close()
		return nil
	})
	if walkErr != nil {
		return "", walkErr
	}

	if len(results) == 0 {
		return "未找到匹配", nil
	}
	if truncated {
		results = append(results, "[grep results truncated at 200 matches]")
	}
	return strings.Join(results, "\n"), nil
}

type Glob struct{}

func (t *Glob) Name() string { return "glob" }
func (t *Glob) Description() string {
	return "按 glob 模式递归查找文件（支持 ** 匹配任意目录）"
}
func (t *Glob) Required() []string { return []string{"pattern"} }
func (t *Glob) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"pattern": {Type: "string", Description: "glob 模式如 '**/*.go' 或 'src/**/*.ts'"},
		"path":    {Type: "string", Description: "可选，搜索根目录，默认当前"},
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

	parts := strings.SplitN(pattern, "**", 2)
	var results []string

	if len(parts) == 2 {
		suffix := strings.TrimPrefix(parts[1], "/")
		filepath.Walk(searchPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() && strings.HasPrefix(info.Name(), ".") && info.Name() != "." {
				return filepath.SkipDir
			}
			rel, _ := filepath.Rel(searchPath, path)
			matched, _ := filepath.Match(suffix, rel)
			if !matched {
				matched, _ = filepath.Match(suffix, filepath.Base(path))
			}
			if matched && !info.IsDir() {
				results = append(results, path)
			}
			if len(results) > 200 {
				return fmt.Errorf("结果超过 200 条，已截断")
			}
			return nil
		})
	} else {
		matches, _ := filepath.Glob(filepath.Join(searchPath, pattern))
		results = matches
	}

	if len(results) == 0 {
		return "未找到匹配文件", nil
	}
	return strings.Join(results, "\n"), nil
}
