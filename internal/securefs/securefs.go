package securefs

import (
	"os"
	"path/filepath"
)

const (
	DirMode  os.FileMode = 0o700
	FileMode os.FileMode = 0o600
)

func EnsureDir(path string) error {
	if err := os.MkdirAll(path, DirMode); err != nil {
		return err
	}
	return os.Chmod(path, DirMode)
}

func WriteFile(path string, data []byte) error {
	if err := EnsureDir(filepath.Dir(path)); err != nil {
		return err
	}
	if err := os.WriteFile(path, data, FileMode); err != nil {
		return err
	}
	return os.Chmod(path, FileMode)
}

func OpenAppend(path string) (*os.File, error) {
	if err := EnsureDir(filepath.Dir(path)); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, FileMode)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(path, FileMode); err != nil {
		_ = f.Close()
		return nil, err
	}
	return f, nil
}

func ChmodFileIfExists(path string) error {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return os.Chmod(path, FileMode)
}
