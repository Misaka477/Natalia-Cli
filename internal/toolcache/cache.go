package toolcache

import (
	"fmt"
	"os"
	"sync"
)

type Cache struct {
	mu      sync.RWMutex
	entries map[string]string
}

func New() *Cache {
	return &Cache{entries: make(map[string]string)}
}

func (c *Cache) Get(toolName string, args map[string]any) (string, bool) {
	key, ok := keyFor(toolName, args)
	if !ok {
		return "", false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	value, ok := c.entries[key]
	return value, ok
}

func (c *Cache) Set(toolName string, args map[string]any, value string) {
	key, ok := keyFor(toolName, args)
	if !ok {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = value
}

func (c *Cache) InvalidatePath(path string) {
	if path == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	prefix := "read_file:" + path + ":"
	for key := range c.entries {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			delete(c.entries, key)
		}
	}
}

func IsCacheable(toolName string) bool {
	return toolName == "read_file"
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

func keyFor(toolName string, args map[string]any) (string, bool) {
	if toolName != "read_file" {
		return "", false
	}
	path, _ := args["path"].(string)
	if path == "" {
		return "", false
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", false
	}
	offset, _ := args["offset"].(string)
	limit, _ := args["limit"].(string)
	return fmt.Sprintf("read_file:%s:%s:%s:%d:%d", path, offset, limit, info.ModTime().UnixNano(), info.Size()), true
}
