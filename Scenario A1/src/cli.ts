import { readFileSync } from "node:fs";
import { check } from "./check.ts";
import type { Routing, Rule, Violation } from "./types.ts";

const USAGE = "Usage: node src/cli.ts --rules <rules.json> [--rules <more-rules.json>] <routing.json>...";

/** Exit codes: 0 all routings pass, 1 at least one violation, 2 usage or file error. */
function main(argv: string[]): number {
  const ruleFiles: string[] = [];
  const routingFiles: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--rules") {
      const file = argv[++i];
      if (file === undefined) return usage("--rules needs a file.");
      ruleFiles.push(file);
    } else {
      routingFiles.push(argv[i]);
    }
  }
  if (ruleFiles.length === 0) return usage("At least one --rules file is required.");
  if (routingFiles.length === 0) return usage("At least one routing file is required.");

  // Rules: all files joined in order (base first, then customer additions).
  const rules: Rule[] = [];
  for (const file of ruleFiles) {
    const parsed = readJson(file);
    if (parsed === undefined) return 2;
    if (!Array.isArray(parsed)) {
      console.error(`${file}: expected a list of rules.`);
      return 2;
    }
    rules.push(...(parsed as Rule[]));
  }

  let fileError = false;
  let failed = 0;
  let checked = 0;
  let errors = 0;
  let warnings = 0;

  for (const file of routingFiles) {
    const routing = readJson(file) as Routing | undefined;
    if (routing === undefined || typeof routing !== "object" || routing === null || Array.isArray(routing)) {
      if (routing !== undefined) console.error(`${file}: expected a routing object.`);
      fileError = true;
      continue;
    }

    checked++;
    const violations = check(routing, rules);
    const label = `${routing.part} (${routing.routing_id})`;

    if (violations.length === 0) {
      console.log(`${label}: OK`);
      continue;
    }

    failed++;
    console.log(`${label}: ${plural(violations.length, "violation")}`);
    for (const v of violations) {
      console.log(formatViolation(v));
      if (v.severity === "error") errors++;
      else warnings++;
    }
  }

  console.log(
    `\n${failed} of ${plural(checked, "routing")} ${checked === 1 ? "has" : "have"} violations ` +
      `(${plural(errors, "error")}, ${plural(warnings, "warning")}).`,
  );

  if (fileError) return 2;
  return failed > 0 ? 1 : 0;
}

function formatViolation(v: Violation): string {
  const ops = v.op_ids.length ? v.op_ids.join(", ") : "-";
  return `  ${v.severity.padEnd(8)} ${(v.rule ?? v.code).padEnd(26)} ${ops.padEnd(12)} ${v.message}`;
}

/** Parsed JSON, or undefined after printing why the file couldn't be used. */
function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    const reason = e instanceof SyntaxError ? "not valid JSON" : (e as NodeJS.ErrnoException).code === "ENOENT" ? "file not found" : String(e);
    console.error(`${file}: ${reason}.`);
    return undefined;
  }
}

function usage(problem: string): number {
  console.error(`${problem}\n${USAGE}`);
  return 2;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

process.exitCode = main(process.argv.slice(2));
