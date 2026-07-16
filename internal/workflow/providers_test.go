package workflow

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMakeProviderDetect(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Makefile"), []byte("build:\n\tgo build ./...\ntest:\n\tgo test ./...\n"), 0644); err != nil {
		t.Fatal(err)
	}

	p := &MakeProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].Name != "build" || tasks[0].Command != "make build" {
		t.Fatalf("unexpected first task: %+v", tasks[0])
	}
	if tasks[1].Name != "test" || tasks[1].Command != "make test" {
		t.Fatalf("unexpected second task: %+v", tasks[1])
	}
}

func TestMakeProviderNoFile(t *testing.T) {
	dir := t.TempDir()
	p := &MakeProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 0 {
		t.Fatalf("expected no tasks, got %d", len(tasks))
	}
}

func TestMakeProviderSkipsSpecialTargets(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Makefile"), []byte(".PHONY: all\nall:\n\tgo build\n"), 0644); err != nil {
		t.Fatal(err)
	}
	p := &MakeProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 1 || tasks[0].Name != "all" {
		t.Fatalf("expected 1 task (all), got %+v", tasks)
	}
}

func TestScriptProviderDetect(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(`{"scripts":{"test":"go test ./...","lint":"go vet ./..."}}`), 0644); err != nil {
		t.Fatal(err)
	}

	p := &ScriptProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].Name != "lint" || tasks[0].Command != "npm run lint" {
		t.Fatalf("unexpected lint task: %+v", tasks[0])
	}
	if tasks[1].Name != "test" || tasks[1].Command != "npm run test" {
		t.Fatalf("unexpected test task: %+v", tasks[1])
	}
}

func TestScriptProviderNoFile(t *testing.T) {
	dir := t.TempDir()
	p := &ScriptProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 0 {
		t.Fatalf("expected no tasks, got %d", len(tasks))
	}
}

func TestScriptProviderSkipsEmptyScripts(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(`{"scripts":{"test":"go test ./...","empty":""}}`), 0644); err != nil {
		t.Fatal(err)
	}
	p := &ScriptProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 1 || tasks[0].Name != "test" {
		t.Fatalf("expected 1 task, got %+v", tasks)
	}
}

func TestTaskfileProviderDetect(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Taskfile.yml"), []byte("version: '3'\ntasks:\n  build:\n    desc: Build the project\n    cmds:\n      - go build ./...\n  test:\n    desc: Run tests\n    cmds:\n      - go test ./...\n"), 0644); err != nil {
		t.Fatal(err)
	}

	p := &TaskfileProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].Name != "build" || tasks[0].Command != "task build" || tasks[0].Description != "Build the project" {
		t.Fatalf("unexpected build task: %+v", tasks[0])
	}
	if tasks[1].Name != "test" || tasks[1].Command != "task test" || tasks[1].Description != "Run tests" {
		t.Fatalf("unexpected test task: %+v", tasks[1])
	}
}

func TestTaskfileProviderNoFile(t *testing.T) {
	dir := t.TempDir()
	p := &TaskfileProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 0 {
		t.Fatalf("expected no tasks, got %d", len(tasks))
	}
}

func TestTaskfileProviderYamlExtension(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Taskfile.yaml"), []byte("version: '3'\ntasks:\n  deploy:\n    desc: Deploy\n    cmds:\n      - echo deploy\n"), 0644); err != nil {
		t.Fatal(err)
	}
	p := &TaskfileProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 1 || tasks[0].Name != "deploy" {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
}

func TestGitHubProviderParseWorkflows(t *testing.T) {
	data := []byte(`[{"name":"CI","id":1},{"name":"Lint","id":2}]`)
	tasks, err := parseGHWorkflows("/test", data)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].Name != "CI" || tasks[0].Command != "gh workflow run CI" {
		t.Fatalf("unexpected CI task: %+v", tasks[0])
	}
	if tasks[1].Name != "Lint" || tasks[1].Command != "gh workflow run Lint" {
		t.Fatalf("unexpected Lint task: %+v", tasks[1])
	}
}

func TestGitHubProviderParseInvalidJSON(t *testing.T) {
	tasks, err := parseGHWorkflows("/test", []byte(`invalid`))
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 0 {
		t.Fatalf("expected no tasks for invalid JSON, got %d", len(tasks))
	}
}

func TestGitHubProviderDetectRunsWithoutError(t *testing.T) {
	p := &GitHubProvider{}
	tasks, err := p.Detect(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, task := range tasks {
		if task.Name == "" {
			t.Fatal("expected non-empty task name")
		}
		if task.Command == "" {
			t.Fatal("expected non-empty command")
		}
	}
}

func TestProviderDiscovery(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Makefile"), []byte("build:\n\tgo build\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(`{"scripts":{"test":"go test"}}`), 0644); err != nil {
		t.Fatal(err)
	}

	taskCount := map[string]int{}
	providers := []Provider{&MakeProvider{}, &ScriptProvider{}, &TaskfileProvider{}, &GitHubProvider{}}
	for _, p := range providers {
		tasks, err := p.Detect(dir)
		if err != nil {
			continue
		}
		taskCount[p.Name()] = len(tasks)
	}
	if taskCount["make"] != 1 {
		t.Fatalf("expected 1 make task, got %d", taskCount["make"])
	}
	if taskCount["script"] != 1 {
		t.Fatalf("expected 1 script task, got %d", taskCount["script"])
	}
	if taskCount["taskfile"] != 0 {
		t.Fatalf("expected 0 taskfile tasks, got %d", taskCount["taskfile"])
	}
	_ = taskCount["github"] // github may or may not be available
}

func TestMakefileWithEmptyLines(t *testing.T) {
	content := []byte(".PHONY: clean\n\nclean:\n\trm -rf build\n\nbuild:\n\tgo build\n")
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Makefile"), content, 0644); err != nil {
		t.Fatal(err)
	}
	p := &MakeProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d: %+v", len(tasks), tasks)
	}
}

func TestTaskWithDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Makefile"), []byte("all:\n\techo hello\n"), 0644); err != nil {
		t.Fatal(err)
	}
	p := &MakeProvider{}
	tasks, err := p.Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if !strings.Contains(tasks[0].Dir, dir) {
		t.Fatalf("expected Dir to contain %q, got %q", dir, tasks[0].Dir)
	}
}
