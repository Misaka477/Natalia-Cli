package sandbox

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

type Box struct {
	Name    string `json:"name"`
	Type    string `json:"type"` // "user" or "agent"
	WorkDir string `json:"work_dir"`
	Overlay string `json:"overlay_dir"`
	Source  string `json:"source,omitempty"`
}

func BaseDir(workDir string) string {
	return filepath.Join(workDir, ".natalia-sandbox")
}

func List(workDir string) ([]Box, error) {
	base := BaseDir(workDir)
	entries, err := os.ReadDir(base)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var boxes []Box
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		meta := filepath.Join(base, e.Name(), "meta.json")
		data, err := os.ReadFile(meta)
		if err != nil {
			continue
		}
		var b Box
		if err := json.Unmarshal(data, &b); err != nil {
			continue
		}
		boxes = append(boxes, b)
	}
	sort.Slice(boxes, func(i, j int) bool {
		return boxes[i].Name < boxes[j].Name
	})
	return boxes, nil
}

func Create(name, sandboxType, workDir string) (*Box, error) {
	base := BaseDir(workDir)
	dir := filepath.Join(base, name)

	if _, err := os.Stat(dir); err == nil {
		return nil, fmt.Errorf("沙盒 %q 已存在", name)
	}

	b := &Box{
		Name:    name,
		Type:    sandboxType,
		WorkDir: workDir,
		Overlay: filepath.Join(dir, "overlay"),
	}

	switch sandboxType {
	case "user":
		if err := os.MkdirAll(b.Overlay, 0755); err != nil {
			return nil, err
		}
	case "agent":
		src := filepath.Join(dir, "source")
		cmd := exec.Command("git", "clone", workDir, src)
		if out, err := cmd.CombinedOutput(); err != nil {
			return nil, fmt.Errorf("git clone 失败: %w\n%s", err, out)
		}
		b.Source = src
		b.Overlay = src
	default:
		return nil, fmt.Errorf("未知沙盒类型: %s（仅支持 user/agent）", sandboxType)
	}

	if err := b.saveMeta(); err != nil {
		return nil, err
	}
	return b, nil
}

func (b *Box) saveMeta() error {
	base := BaseDir(b.WorkDir)
	dir := filepath.Join(base, b.Name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.Marshal(b)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "meta.json"), data, 0644)
}

func (b *Box) ReadFile(path string) ([]byte, error) {
	overlayPath := b.overlayPath(path)
	data, err := os.ReadFile(overlayPath)
	if err == nil {
		return data, nil
	}
	if !os.IsNotExist(err) {
		return nil, err
	}
	return os.ReadFile(filepath.Join(b.WorkDir, path))
}

func (b *Box) WriteFile(path string, data []byte, mode os.FileMode) error {
	fullPath := b.overlayPath(path)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, data, mode)
}

func (b *Box) HasOverlay(path string) bool {
	_, err := os.Stat(b.overlayPath(path))
	return err == nil
}

func (b *Box) Delete() error {
	base := BaseDir(b.WorkDir)
	return os.RemoveAll(filepath.Join(base, b.Name))
}

func (b *Box) Merge() ([]string, error) {
	var changed []string
	err := filepath.WalkDir(b.Overlay, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(b.Overlay, path)
		changed = append(changed, rel)

		target := filepath.Join(b.WorkDir, rel)
		os.MkdirAll(filepath.Dir(target), 0755)
		data, _ := os.ReadFile(path)
		os.WriteFile(target, data, 0644)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return changed, nil
}

func (b *Box) Diff() (string, error) {
	var lines []string
	err := filepath.WalkDir(b.Overlay, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(b.Overlay, path)
		overlayData, _ := os.ReadFile(path)

		origPath := filepath.Join(b.WorkDir, rel)
		origData, _ := os.ReadFile(origPath)

		if string(overlayData) != string(origData) {
			lines = append(lines, fmt.Sprintf("M %s (%d bytes)", rel, len(overlayData)))
		} else {
			lines = append(lines, fmt.Sprintf("  %s (unchanged)", rel))
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	return strings.Join(lines, "\n"), nil
}

func (b *Box) overlayPath(path string) string {
	return filepath.Join(b.Overlay, filepath.Clean("/"+path))
}
