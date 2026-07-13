package secret

import (
	"strings"
	"testing"
)

func TestRedactStringAndJSONBytes(t *testing.T) {
	text := RedactString("api_key=plain-secret Authorization: Bearer bearer-secret safe=ok")
	if strings.Contains(text, "plain-secret") || strings.Contains(text, "bearer-secret") || !strings.Contains(text, Redacted) || !strings.Contains(text, "safe=ok") {
		t.Fatalf("unexpected redacted text: %q", text)
	}

	json := string(RedactJSONBytes([]byte(`{"token":"json-secret","nested":{"password":"pw","safe":"ok"}}`)))
	if strings.Contains(json, "json-secret") || strings.Contains(json, "pw") || !strings.Contains(json, `"safe":"ok"`) || strings.Count(json, Redacted) != 2 {
		t.Fatalf("unexpected redacted json: %s", json)
	}
}

func TestFilterEnvDropsSensitiveUnlessAllowlisted(t *testing.T) {
	env := []string{"VISIBLE=ok", "API_KEY=secret", "TOKEN=secret", "NO_EQUALS"}
	filtered := strings.Join(FilterEnv(env, []string{"TOKEN"}), ",")
	if strings.Contains(filtered, "API_KEY") || !strings.Contains(filtered, "TOKEN=secret") || !strings.Contains(filtered, "VISIBLE=ok") || !strings.Contains(filtered, "NO_EQUALS") {
		t.Fatalf("unexpected filtered env: %s", filtered)
	}
	summary := strings.Join(SummarizeEnv(env), ",")
	if strings.Contains(summary, "secret") || !strings.Contains(summary, "API_KEY=[redacted]") || !strings.Contains(summary, "TOKEN=[redacted]") {
		t.Fatalf("unexpected env summary: %s", summary)
	}
}

func TestValidateEnvName(t *testing.T) {
	if err := ValidateEnvName("NATALIA_TEST_VALUE"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"BAD-NAME", "API_KEY", "ACCESS_TOKEN"} {
		if err := ValidateEnvName(name); err == nil {
			t.Fatalf("expected %s to be rejected", name)
		}
	}
}
