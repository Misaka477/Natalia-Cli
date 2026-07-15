package secret

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
)

const Redacted = "[redacted]"

var envNameRe = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

var envAllowlist struct {
	sync.RWMutex
	names []string
}

func SetEnvAllowlist(names []string) {
	envAllowlist.Lock()
	defer envAllowlist.Unlock()
	envAllowlist.names = append([]string(nil), names...)
}

func ResetEnvAllowlistForTest() {
	envAllowlist.Lock()
	defer envAllowlist.Unlock()
	envAllowlist.names = nil
}

func EnvAllowlist() []string {
	envAllowlist.RLock()
	defer envAllowlist.RUnlock()
	return append([]string(nil), envAllowlist.names...)
}

func SanitizedEnv(extra ...string) []string {
	env := FilterEnv(os.Environ(), EnvAllowlist())
	return append(env, extra...)
}

func IsSensitiveName(name string) bool {
	upper := strings.ToUpper(strings.TrimSpace(name))
	for _, marker := range []string{"SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY", "ACCESS_KEY", "API_KEY", "AUTHORIZATION", "CREDENTIAL", "COOKIE"} {
		if strings.Contains(upper, marker) {
			return true
		}
	}
	return upper == "KEY" || strings.HasSuffix(upper, "_KEY")
}

func ValidateEnvName(name string) error {
	if !envNameRe.MatchString(name) {
		return fmt.Errorf("env variable name %q is invalid", name)
	}
	if IsSensitiveName(name) {
		return fmt.Errorf("env variable name %q looks sensitive and is not allowed", name)
	}
	return nil
}

func FilterEnv(env []string, allowlist []string) []string {
	allowed := make(map[string]bool, len(allowlist))
	for _, name := range allowlist {
		name = strings.TrimSpace(name)
		if name != "" {
			allowed[name] = true
		}
	}
	out := make([]string, 0, len(env))
	for _, item := range env {
		key, _, ok := strings.Cut(item, "=")
		if !ok {
			out = append(out, item)
			continue
		}
		if IsSensitiveName(key) && !allowed[key] {
			continue
		}
		out = append(out, item)
	}
	return out
}

func SummarizeEnv(env []string) []string {
	if len(env) == 0 {
		return nil
	}
	out := make([]string, 0, len(env))
	for _, item := range env {
		key, value, ok := strings.Cut(item, "=")
		if !ok {
			out = append(out, item)
			continue
		}
		if IsSensitiveName(key) {
			value = Redacted
		}
		out = append(out, key+"="+value)
	}
	return out
}

func RedactString(s string) string {
	for _, re := range redactionPatterns {
		s = re.ReplaceAllString(s, "$1"+Redacted)
	}
	return s
}

func RedactJSONBytes(data []byte) []byte {
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return []byte(RedactString(string(data)))
	}
	redacted := RedactValue(value)
	out, err := json.Marshal(redacted)
	if err != nil {
		return []byte(RedactString(string(data)))
	}
	return out
}

func RedactValue(v any) any {
	switch x := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(x))
		for key, value := range x {
			if IsSensitiveName(key) {
				out[key] = Redacted
				continue
			}
			out[key] = RedactValue(value)
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i, value := range x {
			out[i] = RedactValue(value)
		}
		return out
	case string:
		return RedactString(x)
	default:
		return v
	}
}

var redactionPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(\bBearer\s+)[A-Za-z0-9._~+\-/=]+`),
	regexp.MustCompile(`(?i)(\b(?:api[_-]?key|access[_-]?key|secret|token|password|private[_-]?key|authorization|credential|cookie)\b\s*[:=]\s*["']?)[^\s"',}\]]+`),
}
