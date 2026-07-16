package shell

import (
	"bufio"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type History struct {
	entries []string
	index   int
	draft   string
	maxSize int
	path    string
}

func NewHistory(maxSize int) *History {
	if maxSize < 1 {
		maxSize = 1
	}
	return &History{
		index:   -1,
		maxSize: maxSize,
	}
}

func NewWorkspaceHistory(maxSize int) *History {
	h := NewHistory(maxSize)
	wd, err := os.Getwd()
	if err != nil {
		return h
	}
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return h
	}
	sum := sha256.Sum256([]byte(wd))
	h.path = filepath.Join(cacheDir, "natalia-cli", "shell-history", fmt.Sprintf("%x.history", sum[:8]))
	h.load()
	return h
}

func (h *History) AddEntry(text string) {
	if text == "" {
		return
	}
	if len(h.entries) > 0 && h.entries[len(h.entries)-1] == text {
		return
	}
	h.entries = append(h.entries, text)
	if len(h.entries) > h.maxSize {
		h.entries = h.entries[len(h.entries)-h.maxSize:]
	}
	h.index = -1
	h.draft = ""
	h.save()
}

func (h *History) Up() string {
	if len(h.entries) == 0 {
		return h.draft
	}
	if h.index == -1 {
		h.index = len(h.entries) - 1
	} else if h.index > 0 {
		h.index--
	}
	return h.entries[h.index]
}

func (h *History) Down() string {
	if h.index == -1 {
		return h.draft
	}
	h.index++
	if h.index >= len(h.entries) {
		h.index = -1
		return h.draft
	}
	return h.entries[h.index]
}

func (h *History) SaveDraft(text string) {
	h.draft = text
	h.save()
}

func (h *History) Current() string {
	if h.index == -1 {
		return h.draft
	}
	return h.entries[h.index]
}

func (h *History) load() {
	if h.path == "" {
		return
	}
	file, err := os.Open(h.path)
	if err != nil {
		return
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 1024), MaxEditorBytes*2)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 2 || line[1] != ':' {
			continue
		}
		data, err := base64.StdEncoding.DecodeString(line[2:])
		if err != nil {
			continue
		}
		switch line[0] {
		case 'E':
			h.entries = append(h.entries, string(data))
		case 'D':
			h.draft = string(data)
		}
	}
	if len(h.entries) > h.maxSize {
		h.entries = h.entries[len(h.entries)-h.maxSize:]
	}
	h.index = -1
}

func (h *History) save() {
	if h.path == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(h.path), 0o700); err != nil {
		return
	}
	var b strings.Builder
	start := 0
	if len(h.entries) > h.maxSize {
		start = len(h.entries) - h.maxSize
	}
	for _, entry := range h.entries[start:] {
		b.WriteString("E:")
		b.WriteString(base64.StdEncoding.EncodeToString([]byte(entry)))
		b.WriteByte('\n')
	}
	if h.draft != "" {
		b.WriteString("D:")
		b.WriteString(base64.StdEncoding.EncodeToString([]byte(h.draft)))
		b.WriteByte('\n')
	}
	_ = os.WriteFile(h.path, []byte(b.String()), 0o600)
}
