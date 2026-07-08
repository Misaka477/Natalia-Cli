package snapshot

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
)

type Objects struct {
	dir string
}

func NewObjects(base string) (*Objects, error) {
	dir := filepath.Join(base, "objects")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return &Objects{dir: dir}, nil
}

func (o *Objects) Store(data []byte) string {
	h := fmt.Sprintf("%x", sha256.Sum256(data))
	path := filepath.Join(o.dir, h)
	if _, err := os.Stat(path); err == nil {
		return h
	}
	os.WriteFile(path, data, 0644)
	return h
}

func (o *Objects) Load(hash string) ([]byte, error) {
	return os.ReadFile(filepath.Join(o.dir, hash))
}

func (o *Objects) Exists(hash string) bool {
	_, err := os.Stat(filepath.Join(o.dir, hash))
	return err == nil
}
