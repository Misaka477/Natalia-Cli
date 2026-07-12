package snapshot

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type FileEntry struct {
	Path string      `json:"path"`
	Hash string      `json:"hash"`
	Mode os.FileMode `json:"mode"`
}

type Tree struct {
	Files []FileEntry `json:"files"`
}

type Ref struct {
	Step     int    `json:"step"`
	TreeHash string `json:"tree_hash"`
}

type Engine struct {
	BaseDir    string
	Objects    *Objects
	Ignore     *IgnoreMatcher
	workDir    string
	sessionDir string
}

func NewEngine(workDir, sessionDir string) (*Engine, error) {
	baseDir := filepath.Join(sessionDir, "snapshots")
	obs, err := NewObjects(baseDir)
	if err != nil {
		return nil, err
	}
	ignore, _ := LoadIgnore(workDir)
	if len(ignore.Patterns) == 0 {
		ignore = DefaultIgnore()
	}
	return &Engine{
		BaseDir:    baseDir,
		Objects:    obs,
		Ignore:     ignore,
		workDir:    workDir,
		sessionDir: sessionDir,
	}, nil
}

func (e *Engine) ShouldTrack(path string) bool {
	rel, err := filepath.Rel(e.workDir, path)
	if err != nil {
		return false
	}
	if strings.HasPrefix(rel, "..") {
		return false
	}
	if e.Ignore.Ignored(rel) {
		return false
	}
	return true
}

func (e *Engine) BackupFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return e.Objects.Store(data), nil
}

func (e *Engine) SnapshotTree(files []string) (*Tree, error) {
	tree := &Tree{}
	for _, f := range files {
		if !e.ShouldTrack(f) {
			continue
		}
		info, err := os.Stat(f)
		if err != nil {
			continue
		}
		if info.IsDir() {
			continue
		}
		rel, _ := filepath.Rel(e.workDir, f)
		hash, err := e.BackupFile(f)
		if err != nil {
			continue
		}
		tree.Files = append(tree.Files, FileEntry{
			Path: rel,
			Hash: hash,
			Mode: info.Mode(),
		})
	}
	return tree, nil
}

func (e *Engine) SaveTree(tree *Tree) (string, error) {
	data, err := json.Marshal(tree)
	if err != nil {
		return "", err
	}
	return e.Objects.Store(data), nil
}

func (e *Engine) LoadTree(hash string) (*Tree, error) {
	data, err := e.Objects.Load(hash)
	if err != nil {
		return nil, err
	}
	var tree Tree
	if err := json.Unmarshal(data, &tree); err != nil {
		return nil, err
	}
	return &tree, nil
}

func (e *Engine) Checkpoint(step int, files []string) (string, error) {
	tree, err := e.SnapshotTree(files)
	if err != nil {
		return "", err
	}
	treeHash, err := e.SaveTree(tree)
	if err != nil {
		return "", err
	}
	ref := Ref{Step: step, TreeHash: treeHash}
	data, _ := json.Marshal(ref)
	refsFile := filepath.Join(e.sessionDir, "refs.jsonl")
	f, err := os.OpenFile(refsFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return "", err
	}
	defer f.Close()
	f.Write(append(data, '\n'))
	return treeHash, nil
}

func (e *Engine) Rollback(step int) error {
	refsFile := filepath.Join(e.sessionDir, "refs.jsonl")
	data, err := os.ReadFile(refsFile)
	if err != nil {
		return err
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	var targetRef *Ref
	for _, line := range lines {
		if line == "" {
			continue
		}
		var ref Ref
		if err := json.Unmarshal([]byte(line), &ref); err != nil {
			continue
		}
		if ref.Step == step {
			targetRef = &ref
		}
		if ref.Step > step {
			break
		}
	}
	if targetRef == nil {
		return fmt.Errorf("step %d 没有对应的快照", step)
	}

	tree, err := e.LoadTree(targetRef.TreeHash)
	if err != nil {
		return err
	}

	for _, entry := range tree.Files {
		data, err := e.Objects.Load(entry.Hash)
		if err != nil {
			continue
		}
		fullPath := filepath.Join(e.workDir, entry.Path)
		os.MkdirAll(filepath.Dir(fullPath), 0755)
		os.WriteFile(fullPath, data, entry.Mode)
	}
	return nil
}

func (e *Engine) GetTreeHash(step int) (string, error) {
	refsFile := filepath.Join(e.sessionDir, "refs.jsonl")
	data, err := os.ReadFile(refsFile)
	if err != nil {
		return "", err
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		var ref Ref
		if err := json.Unmarshal([]byte(line), &ref); err != nil {
			continue
		}
		if ref.Step == step {
			return ref.TreeHash, nil
		}
	}
	return "", fmt.Errorf("step %d not found", step)
}

func hashFile(path string) string {
	data, _ := os.ReadFile(path)
	return fmt.Sprintf("%x", sha256.Sum256(data))
}
