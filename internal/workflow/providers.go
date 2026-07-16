package workflow

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type Provider interface {
	Name() string
	Detect(root string) ([]*Task, error)
}

type Task struct {
	Name        string
	Description string
	Command     string
	Dir         string
}

type MakeProvider struct{}

func (p *MakeProvider) Name() string { return "make" }

func (p *MakeProvider) Detect(root string) ([]*Task, error) {
	for _, name := range []string{"Makefile", "makefile"} {
		data, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			continue
		}
		return parseMakeTargets(root, data)
	}
	return nil, nil
}

func parseMakeTargets(root string, data []byte) ([]*Task, error) {
	var tasks []*Task
	seen := map[string]bool{}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "\t") || strings.HasPrefix(strings.TrimSpace(line), "#") || strings.TrimSpace(line) == "" {
			continue
		}
		name, _, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name = strings.TrimSpace(name)
		if name == "" || strings.ContainsAny(name, " $(){}") || strings.HasPrefix(name, ".") || seen[name] {
			continue
		}
		seen[name] = true
		tasks = append(tasks, &Task{
			Name:        name,
			Description: "Makefile target",
			Command:     "make " + name,
			Dir:         root,
		})
	}
	sort.Slice(tasks, func(i, j int) bool { return tasks[i].Name < tasks[j].Name })
	return tasks, nil
}

type TaskfileProvider struct{}

func (p *TaskfileProvider) Name() string { return "taskfile" }

func (p *TaskfileProvider) Detect(root string) ([]*Task, error) {
	for _, name := range []string{"Taskfile.yml", "Taskfile.yaml"} {
		data, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			continue
		}
		return parseTaskfile(root, data)
	}
	return nil, nil
}

type taskfileTask struct {
	Desc string `yaml:"desc"`
	Cmds []any  `yaml:"cmds"`
}

type taskfileRoot struct {
	Version string                  `yaml:"version"`
	Tasks   map[string]taskfileTask `yaml:"tasks"`
}

func parseTaskfile(root string, data []byte) ([]*Task, error) {
	var tf taskfileRoot
	if err := yaml.Unmarshal(data, &tf); err != nil {
		return nil, err
	}
	var tasks []*Task
	for name, t := range tf.Tasks {
		cmd := "task " + name
		tasks = append(tasks, &Task{
			Name:        name,
			Description: t.Desc,
			Command:     cmd,
			Dir:         root,
		})
	}
	sort.Slice(tasks, func(i, j int) bool { return tasks[i].Name < tasks[j].Name })
	return tasks, nil
}

type ScriptProvider struct{}

func (p *ScriptProvider) Name() string { return "script" }

func (p *ScriptProvider) Detect(root string) ([]*Task, error) {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return nil, nil
	}
	return parseScripts(root, data)
}

func parseScripts(root string, data []byte) ([]*Task, error) {
	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, nil
	}
	var tasks []*Task
	names := make([]string, 0, len(pkg.Scripts))
	for name := range pkg.Scripts {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		script := pkg.Scripts[name]
		if strings.TrimSpace(script) == "" {
			continue
		}
		tasks = append(tasks, &Task{
			Name:        name,
			Description: "package.json script",
			Command:     "npm run " + name,
			Dir:         root,
		})
	}
	return tasks, nil
}

type GitHubProvider struct{}

func (p *GitHubProvider) Name() string { return "github" }

func (p *GitHubProvider) Detect(root string) ([]*Task, error) {
	cmd := exec.Command("gh", "workflow", "list", "--json", "name,id")
	output, err := cmd.Output()
	if err != nil {
		return nil, nil
	}
	return parseGHWorkflows(root, output)
}

type ghWorkflow struct {
	Name string `json:"name"`
	ID   int64  `json:"id"`
}

func parseGHWorkflows(root string, data []byte) ([]*Task, error) {
	var workflows []ghWorkflow
	if err := json.Unmarshal(data, &workflows); err != nil {
		return nil, nil
	}
	var tasks []*Task
	for _, wf := range workflows {
		tasks = append(tasks, &Task{
			Name:        wf.Name,
			Description: "GitHub Actions workflow",
			Command:     "gh workflow run " + wf.Name,
			Dir:         root,
		})
	}
	sort.Slice(tasks, func(i, j int) bool { return tasks[i].Name < tasks[j].Name })
	return tasks, nil
}
