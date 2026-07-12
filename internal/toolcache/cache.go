package toolcache

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type Cache struct {
	mu      sync.RWMutex
	entries map[string]entry
}

type entry struct {
	value      string
	searchRoot string
}

func New() *Cache {
	return &Cache{entries: make(map[string]entry)}
}

func (c *Cache) Get(toolName string, args map[string]any) (string, bool) {
	key, ok := keyFor(toolName, args)
	if !ok {
		return "", false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	value, ok := c.entries[key]
	return value.value, ok
}

func (c *Cache) Set(toolName string, args map[string]any, value string) {
	key, ok := keyFor(toolName, args)
	if !ok {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = entry{value: value, searchRoot: searchRootFor(toolName, args)}
}

func (c *Cache) InvalidatePath(path string) {
	if path == "" {
		return
	}
	absPath, ok := normalizePath(path)
	if !ok {
		c.InvalidateAll()
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	prefix := "read_file:" + absPath + ":"
	for key, ent := range c.entries {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			delete(c.entries, key)
			continue
		}
		if (len(key) >= 5 && (key[:5] == "glob:" || key[:5] == "grep:")) && searchRootAffected(ent.searchRoot, absPath) {
			delete(c.entries, key)
		}
	}
}

func (c *Cache) InvalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]entry)
}

func searchRootFor(toolName string, args map[string]any) string {
	if toolName != "glob" && toolName != "grep" {
		return ""
	}
	path, _ := args["path"].(string)
	if path == "" {
		path = "."
	}
	root, ok := normalizePath(path)
	if !ok {
		return ""
	}
	return root
}

func searchRootAffected(root, absPath string) bool {
	if root == "" {
		return true
	}
	if root == absPath {
		return true
	}
	rel, err := filepath.Rel(root, absPath)
	return err == nil && rel != "." && !isParentRel(rel)
}

func isParentRel(rel string) bool {
	return rel == ".." || len(rel) > 3 && rel[:3] == ".."+string(filepath.Separator)
}

func IsCacheable(toolName string) bool {
	return toolName == "read_file" || toolName == "glob" || toolName == "grep"
}

func MutatedPath(toolName string, args map[string]any, errMsg string) string {
	if errMsg != "" {
		return ""
	}
	if toolName != "write_file" && toolName != "edit_file" {
		return ""
	}
	path, _ := args["path"].(string)
	return path
}

func MutatesUnknownFiles(toolName string, errMsg string) bool {
	return errMsg == "" && toolName == "run_shell"
}

func keyFor(toolName string, args map[string]any) (string, bool) {
	if toolName == "glob" || toolName == "grep" {
		data, err := json.Marshal(args)
		if err != nil {
			return "", false
		}
		return toolName + ":" + string(data), true
	}
	if toolName != "read_file" {
		return "", false
	}
	path, _ := args["path"].(string)
	if path == "" {
		return "", false
	}
	absPath, ok := normalizePath(path)
	if !ok {
		return "", false
	}
	info, err := os.Stat(absPath)
	if err != nil {
		return "", false
	}
	offset, _ := args["offset"].(string)
	limit, _ := args["limit"].(string)
	return fmt.Sprintf("read_file:%s:%s:%s:%d:%d", absPath, offset, limit, info.ModTime().UnixNano(), info.Size()), true
}

func normalizePath(path string) (string, bool) {
	absPath, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return "", false
	}
	return absPath, true
}
