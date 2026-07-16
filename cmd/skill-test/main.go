package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/skill"
)

func main() {
	fixtureDirs := []string{
		"devref/fixture-skills/dev-runtime-skill/skills",
		"devref/fixture-skills/anthropics-skills/skills",
		"devref/fixture-skills/anthropics-skills/template",
		"devref/fixture-skills/superpowers/skills",
		"devref/fixture-skills/ECC",
	}

	fmt.Println("=== Natalia Agent Skills Fixture Test ===")
	fmt.Println()

	var allResults []fixtureResult

	for _, dir := range fixtureDirs {
		absDir, err := filepath.Abs(dir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "SKIP %s: %v\n", dir, err)
			continue
		}
		entries, err := os.ReadDir(absDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "SKIP %s: %v\n", dir, err)
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			skillDir := filepath.Join(absDir, e.Name())
			skillFile := filepath.Join(skillDir, "SKILL.md")
			if _, err := os.Stat(skillFile); os.IsNotExist(err) {
				continue
			}
			result := testSingleSkill(skillFile, dir)
			allResults = append(allResults, result)
		}
	}

	fmt.Println()
	fmt.Println("=== Summary ===")
	pass, fail, skip := 0, 0, 0
	for _, r := range allResults {
		switch r.status {
		case "PASS":
			pass++
		case "FAIL":
			fail++
		case "SKIP":
			skip++
		}
	}
	fmt.Printf("PASS: %d  FAIL: %d  SKIP: %d  TOTAL: %d\n", pass, fail, skip, len(allResults))
	if fail > 0 {
		fmt.Println()
		fmt.Println("Failed skills:")
		for _, r := range allResults {
			if r.status == "FAIL" {
				fmt.Printf("  %s: %s\n", r.name, r.err)
			}
		}
		os.Exit(1)
	}
}

type fixtureResult struct {
	name   string
	status string
	err    string
}

func testSingleSkill(skillFile string, rootLabel string) fixtureResult {
	name := strings.TrimPrefix(skillFile, filepath.Dir(filepath.Dir(skillFile))+"/")
	fmt.Printf("[  ] %s ... ", name)
	start := time.Now()

	fm, body, err := skill.ParseSKILL(skillFile)
	if err != nil {
		fmt.Printf("FAIL (%v)\n", err)
		return fixtureResult{name: name, status: "FAIL", err: err.Error()}
	}

	vr := skill.Validate(fm)
	if !vr.Valid {
		fmt.Printf("FAIL validation: %s\n", strings.Join(vr.Errors, "; "))
		return fixtureResult{name: name, status: "FAIL", err: strings.Join(vr.Errors, "; ")}
	}

	elapsed := time.Since(start).Round(time.Microsecond)
	bodyPreview := ""
	if len(body) > 40 {
		bodyPreview = body[:40] + "..."
	} else {
		bodyPreview = body
	}
	warnings := ""
	if len(vr.Warnings) > 0 {
		warnings = fmt.Sprintf(" [warn: %s]", strings.Join(vr.Warnings, "; "))
	}
	extras := []string{}
	if fm.Invocation != nil {
		extras = append(extras, fmt.Sprintf("invocation=%s", fm.Invocation.Type))
	}
	if fm.ToolPolicy != nil {
		extras = append(extras, "tool-policy")
	}
	if fm.Context != nil {
		extras = append(extras, "context")
	}
	if fm.AllowedTools != nil {
		extras = append(extras, fmt.Sprintf("tools=%d", len(fm.AllowedTools)))
	}
	extrasStr := ""
	if len(extras) > 0 {
		extrasStr = " [" + strings.Join(extras, " ") + "]"
	}
	fmt.Printf("PASS (%s)%s%s\n", elapsed, warnings, extrasStr)
	fmt.Printf("       name=%s desc=%s body=%q\n", fm.Name, fm.Description, bodyPreview)
	return fixtureResult{name: name, status: "PASS"}
}
