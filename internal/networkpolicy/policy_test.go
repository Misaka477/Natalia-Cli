package networkpolicy

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestDefaultPolicyRejectsLocalAndPrivateTargets(t *testing.T) {
	policy := Default()
	for _, raw := range []string{
		"http://localhost/",
		"http://127.0.0.1/",
		"http://10.0.0.1/",
		"http://192.168.1.1/",
		"http://[::1]/",
		"http://169.254.169.254/latest/meta-data/",
	} {
		if err := policy.ValidateURL(nil, raw); err == nil {
			t.Fatalf("expected default policy to reject %s", raw)
		}
	}
}

func TestPolicyAllowsPublicIPAndConfiguredAllowlist(t *testing.T) {
	policy := Default()
	if err := policy.ValidateURL(nil, "https://93.184.216.34/"); err != nil {
		t.Fatalf("expected public IP to be allowed: %v", err)
	}

	allowed, err := New(Config{AllowedHosts: []string{"localhost"}, AllowedCIDRs: []string{"127.0.0.0/8"}})
	if err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{"http://localhost/", "http://127.0.0.1/"} {
		if err := allowed.ValidateURL(nil, raw); err != nil {
			t.Fatalf("expected allowlist to permit %s: %v", raw, err)
		}
	}
}

func TestHTTPClientRejectsRedirectToBlockedAddress(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/latest/meta-data/", http.StatusFound)
	}))
	defer server.Close()

	policy, err := New(Config{AllowLocalhost: true})
	if err != nil {
		t.Fatal(err)
	}
	_, err = policy.HTTPClient(2 * time.Second).Get(server.URL)
	if err == nil || !strings.Contains(err.Error(), "169.254.169.254") || !strings.Contains(err.Error(), "link-local") {
		t.Fatalf("expected redirect to metadata endpoint to be rejected, got %v", err)
	}
}

func TestPolicyRejectsUnsupportedSchemeWithDiagnostic(t *testing.T) {
	policy := Default()
	err := policy.ValidateURL(nil, "file:///etc/passwd")
	if err == nil || !strings.Contains(err.Error(), "scheme") || !strings.Contains(err.Error(), "file") {
		t.Fatalf("expected scheme diagnostic, got %v", err)
	}
}
