package prefetch

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/aquama/natalia-cli/internal/mode"
	"github.com/aquama/natalia-cli/internal/toolcache"
	"github.com/aquama/natalia-cli/internal/toolset"
)

const DefaultTimeout = 2 * time.Second

type Options struct {
	Tools   *toolset.Registry
	Cache   *toolcache.Cache
	Mode    *mode.Mode
	Input   string
	Timeout time.Duration
}

type Result struct {
	Planned int
	Cached  int
	Errors  int
}

type task struct {
	name string
	args map[string]any
}

func Warm(ctx context.Context, opts Options) Result {
	if opts.Tools == nil || opts.Cache == nil {
		return Result{}
	}
	tasks := plan(opts)
	if len(tasks) == 0 {
		return Result{}
	}
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var wg sync.WaitGroup
	results := make(chan bool, len(tasks))
	scheduled := 0
	for _, t := range tasks {
		tool, ok := opts.Tools.Get(t.name)
		if !ok {
			continue
		}
		if opts.Mode != nil && !opts.Mode.ToolFilter(t.name, t.args) {
			continue
		}
		scheduled++
		wg.Add(1)
		go func(t task, tool toolset.Tool) {
			defer wg.Done()
			if _, ok := opts.Cache.Get(t.name, t.args); ok {
				results <- true
				return
			}
			value, err := tool.Execute(t.args)
			if err != nil {
				results <- false
				return
			}
			opts.Cache.Set(t.name, t.args, value)
			results <- true
		}(t, tool)
	}
	if scheduled == 0 {
		return Result{}
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	out := Result{Planned: scheduled}
	for {
		select {
		case ok, open := <-results:
			if !open {
				return out
			}
			if ok {
				out.Cached++
			} else {
				out.Errors++
			}
		case <-ctx.Done():
			out.Errors += scheduled - out.Cached - out.Errors
			return out
		}
	}
}

func plan(opts Options) []task {
	input := strings.ToLower(opts.Input)
	seen := make(map[string]bool)
	var tasks []task
	add := func(name string, args map[string]any) {
		key := name + ":" + stableArgs(args)
		if seen[key] {
			return
		}
		seen[key] = true
		tasks = append(tasks, task{name: name, args: args})
	}

	for _, path := range mentionedPaths(opts.Input) {
		add("read_file", map[string]any{"path": path})
	}
	if strings.Contains(input, ".go") || strings.Contains(input, "go ") || strings.Contains(input, "test") || strings.Contains(input, "编译") || strings.Contains(input, "测试") {
		add("glob", map[string]any{"pattern": "**/*.go"})
	}
	if strings.Contains(input, "test") || strings.Contains(input, "测试") || strings.Contains(input, "回归") {
		add("glob", map[string]any{"pattern": "**/*_test.go"})
	}
	if strings.Contains(input, "roadmap") || strings.Contains(input, "plan") || strings.Contains(input, "文档") || strings.Contains(input, "计划") {
		add("glob", map[string]any{"pattern": "**/*.md"})
	}
	if token := likelyCodeToken(opts.Input); token != "" {
		add("grep", map[string]any{"pattern": regexp.QuoteMeta(token), "path": ".", "include": "*.go"})
	}
	if len(tasks) > 4 {
		return tasks[:4]
	}
	return tasks
}

var quotedPathRe = regexp.MustCompile("[`\"]([^`\"]+\\.[A-Za-z0-9_./-]+)[`\"]")

func mentionedPaths(input string) []string {
	matches := quotedPathRe.FindAllStringSubmatch(input, -1)
	var out []string
	for _, m := range matches {
		path := filepath.Clean(m[1])
		if path == "." || strings.HasPrefix(path, "..") || strings.Contains(path, string(filepath.Separator)+".."+string(filepath.Separator)) {
			continue
		}
		base := strings.ToLower(filepath.Base(path))
		if strings.HasPrefix(base, ".env") || strings.Contains(path, ".ssh") {
			continue
		}
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			out = append(out, path)
		}
	}
	return out
}

var codeTokenRe = regexp.MustCompile("`([A-Za-z_][A-Za-z0-9_]{2,79})`")

func likelyCodeToken(input string) string {
	m := codeTokenRe.FindStringSubmatch(input)
	if len(m) == 2 {
		return m[1]
	}
	return ""
}

func stableArgs(args map[string]any) string {
	data, err := json.Marshal(args)
	if err != nil {
		return ""
	}
	return string(data)
}
