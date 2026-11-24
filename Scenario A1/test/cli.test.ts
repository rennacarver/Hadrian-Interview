import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const STANDARD = "examples/rules/standard.json";
const CUSTOMER_B = "examples/rules/customer-b.json";

const cli = (...args: string[]) => {
  const r = spawnSync(process.execPath, ["src/cli.ts", ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

describe("cli: usage", () => {
  it("no arguments → usage on stderr, exit 2", () => {
    const r = cli();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage/i);
  });

  it("routings without --rules → exit 2", () => {
    expect(cli("examples/TEST-CLEAN.json").status).toBe(2);
  });

  it("--rules without routings → exit 2", () => {
    expect(cli("--rules", STANDARD).status).toBe(2);
  });

  it("--rules with no file after it → exit 2", () => {
    expect(cli("examples/TEST-CLEAN.json", "--rules").status).toBe(2);
  });
});

describe("cli: results", () => {
  it("passing routing → OK, exit 0", () => {
    const r = cli("--rules", STANDARD, "examples/TEST-CLEAN.json");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TEST-CLEAN (R-T001): OK");
  });

  it("failing routing → each violation with severity, rule, ops and message, exit 1", () => {
    const r = cli("--rules", STANDARD, "examples/BRKT-2201.json");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("BRKT-2201 (R-10442): 1 violation");
    expect(r.stdout).toMatch(/error\s+MACHINING_BEFORE_SURFACE\s+op20, op40\s+MILL op20 is not guaranteed to run before ANODIZE op40\./);
  });

  it("several routings → all violations from all of them, plus a summary", () => {
    const r = cli("--rules", STANDARD, "examples/BRKT-2201.json", "examples/HSG-0187.json", "examples/TEST-CLEAN.json");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("BRKT-2201 (R-10442): 1 violation");
    expect(r.stdout).toContain("CMM_AFTER_MACHINING");
    expect(r.stdout).toContain("HSG-0187 (R-09876): 1 violation");
    expect(r.stdout).toContain("TEST-CLEAN (R-T001): OK");
    expect(r.stdout).toContain("2 of 3 routings have violations (2 errors, 0 warnings)");
  });

  it("every violation in a routing is printed", () => {
    // TWO-PACK under base rules + an extra rule that also fails
    const dir = mkdtempSync(join(tmpdir(), "cli-test-"));
    const extra = join(dir, "extra.json");
    writeFileSync(extra, JSON.stringify([{ id: "THREE_CMM", kind: "MIN_COUNT", types: ["CMM_INSPECT"], min: 3 }]));
    const r = cli("--rules", STANDARD, "--rules", extra, "examples/TEST-TWO-PACK.json");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("TEST-TWO-PACK (R-T010): 2 violations");
    expect(r.stdout).toContain("PACK_LAST");
    expect(r.stdout).toContain("THREE_CMM");
  });

  it("repeated --rules are combined: base + Customer B additions", () => {
    expect(cli("--rules", STANDARD, "examples/TEST-CUSTB-FAIL.json").status).toBe(0);
    const r = cli("--rules", STANDARD, "--rules", CUSTOMER_B, "examples/TEST-CUSTB-FAIL.json");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("TWO_VISUAL_INSPECTIONS");
  });

  it("warnings are printed with their code and fail the run", () => {
    const r = cli("--rules", STANDARD, "examples/TEST-CYCLE.json");
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/warning\s+CYCLE/);
    expect(r.stdout).toContain("(0 errors, 1 warning)");
  });
});

describe("cli: bad files", () => {
  it("missing routing file → error on stderr, others still checked, exit 2", () => {
    const r = cli("--rules", STANDARD, "examples/NOPE.json", "examples/TEST-CLEAN.json");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("examples/NOPE.json");
    expect(r.stdout).toContain("TEST-CLEAN (R-T001): OK");
  });

  it("routing file that isn't valid JSON → exit 2", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-test-"));
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ not json");
    const r = cli("--rules", STANDARD, bad);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(bad);
  });

  it("unreadable rules file → exit 2, nothing checked", () => {
    const r = cli("--rules", "examples/rules/NOPE.json", "examples/TEST-CLEAN.json");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("examples/rules/NOPE.json");
    expect(r.stdout).toBe("");
  });

  it("rules file that isn't a list → exit 2", () => {
    const r = cli("--rules", "examples/TEST-CLEAN.json", "examples/TEST-CLEAN.json");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/list of rules/);
  });
});
