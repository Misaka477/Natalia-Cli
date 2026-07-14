package commandpolicy

import (
	"strings"
	"testing"
)

func TestEvaluateLevels(t *testing.T) {
	cases := []struct {
		command     string
		args        []string
		wantLevel   Level
		wantSubstr  string
	}{
		{"go", []string{"test", "./..."}, LevelAllow, ""},
		{"git", []string{"status"}, LevelAllow, ""},
		{"rm", []string{"-rf", "/tmp/foo"}, LevelAllow, ""},
		{"cat", []string{"/proc/cpuinfo"}, LevelAllow, ""},
		{"curl", []string{"https://example.test/install", "|", "bash"}, LevelExplicitApproval, "remote download piped to shell"},
		{"shutdown", []string{"now"}, LevelExplicitApproval, "shutdown"},
		{"reboot", []string{}, LevelExplicitApproval, "reboot"},
		{"rm", []string{"-rf", "/"}, LevelHardDeny, "rm -rf /"},
		{"rm", []string{"-fr", "/"}, LevelHardDeny, "rm -fr /"},
		{"mkfs", []string{"./fs"}, LevelHardDeny, "mkfs"},
		{"dd", []string{"if=/dev/zero", "of=/dev/sda"}, LevelHardDeny, "dd if=/dev/"},
		{"chmod", []string{"-r", "/"}, LevelHardDeny, "root filesystem"},
		{"chown", []string{"-r", "/"}, LevelHardDeny, "root filesystem"},
		{"bash", []string{"-c", "echo hi > /proc/cpuinfo"}, LevelExplicitApproval, "kernel control filesystem"},
	}
	for _, tc := range cases {
		t.Run(tc.command+" "+strings.Join(tc.args, " "), func(t *testing.T) {
			got := Evaluate(tc.command, tc.args)
			if got.Level != tc.wantLevel {
				t.Fatalf("Evaluate(%q %v)=level=%s want=%s", tc.command, tc.args, got.Level, tc.wantLevel)
			}
			if tc.wantSubstr != "" && !strings.Contains(got.Reason, tc.wantSubstr) {
				t.Fatalf("Evaluate(%q %v)=reason=%q want substring %q", tc.command, tc.args, got.Reason, tc.wantSubstr)
			}
		})
	}
}

func TestRequireConfirmationRejectsHardDeny(t *testing.T) {
	decision := Evaluate("rm", []string{"-rf", "/"})
	err := RequireConfirmation(nil, decision)
	if err == nil {
		t.Fatal("expected hard deny rejection")
	}
	if !strings.Contains(err.Error(), "hard denied") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRequireConfirmationBypassesAllow(t *testing.T) {
	decision := Evaluate("go", []string{"test", "./..."})
	err := RequireConfirmation(nil, decision)
	if err != nil {
		t.Fatalf("allow command rejected: %v", err)
	}
}

func TestRequireConfirmationRequiresMarkerForExplicitApproval(t *testing.T) {
	decision := Evaluate("shutdown", []string{"now"})
	err := RequireConfirmation(nil, decision)
	if err == nil {
		t.Fatal("expected missing confirmation rejection")
	}
	args := map[string]any{}
	MarkConfirmed(args)
	err = RequireConfirmation(args, decision)
	if err != nil {
		t.Fatalf("confirmed command rejected: %v", err)
	}
}
