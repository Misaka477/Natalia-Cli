package file

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/aquama/natalia-cli/internal/llm"
)

type Read struct{}

func (t *Read) Name() string        { return "read_file" }
func (t *Read) Description() string { return "读取文件内容" }
func (t *Read) Required() []string  { return []string{"path"} }
func (t *Read) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"path":  {Type: "string", Description: "文件绝对路径"},
		"limit": {Type: "string", Description: "可选，行数限制如 '1-50' 或空"},
	}
}
func (t *Read) Execute(args map[string]any) (string, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return "", fmt.Errorf("path required")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	return string(data), nil
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

func (t *Grep) Name() string        { return "grep" }
func (t *Grep) Description() string { return "在文件中递归搜索文本（支持正则表达式）" }
func (t *Grep) Required() []string  { return []string{"pattern"} }
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
	filepath.Walk(searchPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
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
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		lines := strings.Split(string(data), "\n")
		for i, line := range lines {
			if re.MatchString(line) {
				results = append(results, fmt.Sprintf("%s:%d: %s", path, i+1, strings.TrimSpace(line)))
			}
		}
		if len(results) > 200 {
			return fmt.Errorf("结果超过 200 条，已截断")
		}
		return nil
	})

	if len(results) == 0 {
		return "未找到匹配", nil
	}
	return strings.Join(results, "\n"), nil
}

type Glob struct{}

func (t *Glob) Name() string        { return "glob" }
func (t *Glob) Description() string { return "按 glob 模式递归查找文件（支持 ** 匹配任意目录）" }
func (t *Glob) Required() []string  { return []string{"pattern"} }
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
