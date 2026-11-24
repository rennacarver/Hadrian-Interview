# Routing Rule Checker — Spec

## Problem

A routing can be released that violates customer rules. `check()` finds those violations before release.

## Scope

- **Now:** `check(routing, rules) → Violation[]`. All rule logic lives here.
- **CLI:** `src/cli.ts` reads routing and rule files and prints all violations (see CLI below).
- **Out:** UI, fixing routings, storing results. Anything not listed here needs confirmation before it is built.

## Input

### Routing

An already-parsed routing object (the CLI will do file reading).

```json
{
  "routing_id": "R-10442",
  "part": "BRKT-2201",
  "customer": "Customer A",
  "operations": [
    { "id": "op10", "type": "MILL",    "after": [] },
    { "id": "op20", "type": "ANODIZE", "after": ["op10"] }
  ]
}
```

Operations form a DAG. `after` lists the ids that must finish before this op starts. Array order means nothing. `check()` does not read `customer`: the caller chooses which rules to pass.

### Rules

No customer rule is hardcoded. `check()` knows four generic rule **kinds**; a rule list is plain data (so it can live in a JSON file) that configures them. Each rule has an `id`, chosen by whoever writes the list, which is copied into its violations.

| Kind           | Parameters                         | Checks |
| -------------- | ---------------------------------- | ------ |
| `ORDER_BEFORE` | `first: string[]`, `then: string[]` | Every op of a `first` type is before every op of a `then` type. |
| `FOLLOWED_BY`  | `targets: string[]`, `requires: string[]` | Every `targets` op that could run last among the `targets` ops has a `requires` op after it. No `targets` ops → passes. |
| `MIN_COUNT`    | `types: string[]`, `min: number`    | The routing has at least `min` ops of the given types. Position doesn't matter. |
| `LAST`         | `type: string`                      | Exactly one op of `type`, and every other op is before it. |

An empty rule list checks nothing except malformed input. Rule lists are trusted input and are not validated.

### Ordering

**A is before B** when A is reachable by following `after` links back from B (A is a transitive ancestor of B). If neither is an ancestor of the other, they are **unordered**: either could run first, so an unordered pair counts as possibly in the wrong order.

### Known operation types

`MILL`, `TURN`, `DRILL`, `DEBURR`, `PAINT`, `ANODIZE`, `CMM_INSPECT`, `VISUAL_INSPECT`, `PACK`. Matching is exact (case-sensitive). Any other type → `UNRECOGNIZED_TYPE` warning. The op still takes part in any rule that names its type, and it still has to come before the `LAST` op.

## Current customer rules

Kept as data in `examples/rules/`, not in `check()`. Machining is `MILL`, `TURN`, `DRILL`. `DEBURR` is **not** machining.

There is a **base** rule set that applies to every routing. A customer's rule file holds only that customer's **additions**; it never removes or replaces a base rule. The caller combines them and passes the result: `check(routing, [...base, ...customerAdditions])`. A customer with no additions gets the base set.

| Rule id                    | Kind           | Parameters | File |
| -------------------------- | -------------- | ---------- | ---- |
| `MACHINING_BEFORE_SURFACE` | `ORDER_BEFORE` | first: machining, then: `PAINT`, `ANODIZE` | `standard.json` (base) |
| `CMM_AFTER_MACHINING`      | `FOLLOWED_BY`  | targets: machining, requires: `CMM_INSPECT` (`VISUAL_INSPECT` doesn't count) | `standard.json` (base) |
| `PACK_LAST`                | `LAST`         | type: `PACK` | `standard.json` (base) |
| `TWO_VISUAL_INSPECTIONS`   | `MIN_COUNT`    | types: `VISUAL_INSPECT`, min: 2 | `customer-b.json` (Customer B addition) |

## Output

```ts
interface Violation {
  routing_id: string;
  part: string;
  rule: string | null;   // id of the rule that produced it; null for malformed-input warnings
  code: ViolationCode;
  severity: "error" | "warning";
  op_ids: string[];
  message: string;
}
```

An empty array means the routing passes the rules given. Order of violations is not guaranteed. In `op_ids`, pairs keep the order shown below; other lists (`MIN_COUNT`, `MULTIPLE_LAST`) are in input order; `CYCLE` ids are in no set order. Message wording is not part of the contract.

### Rule violations (severity `error`)

| Code            | From           | One per                                          | `op_ids`              |
| --------------- | -------------- | ------------------------------------------------ | --------------------- |
| `ORDER_BEFORE`  | `ORDER_BEFORE` | (`first` op, `then` op) pair not in order        | `[firstId, thenId]`   |
| `FOLLOWED_BY`   | `FOLLOWED_BY`  | `targets` op that could run last with no `requires` op after it | `[targetId]` |
| `MIN_COUNT`     | `MIN_COUNT`    | rule, when the count is below `min`              | ids of matching ops   |
| `MISSING_LAST`  | `LAST`         | rule, when there is no op of `type`              | `[]`                  |
| `MULTIPLE_LAST` | `LAST`         | rule, when there is more than one op of `type`   | ids of those ops      |
| `NOT_LAST`      | `LAST`         | (other op, last op) pair where the other op is not before it. Pairs of two `type` ops are not reported (`MULTIPLE_LAST` covers them). | `[opId, lastId]` |

### Malformed input (severity `warning`, `rule: null`)

| Code                | When                                              | `op_ids`            |
| ------------------- | ------------------------------------------------- | ------------------- |
| `EMPTY`             | `operations` missing or `[]`                      | `[]`                |
| `DUPLICATE_ID`      | two or more ops share an `id` (one per id)        | `[id]`              |
| `INVALID_AFTER`     | `after` names an id that doesn't exist            | `[opId, missingId]` |
| `CYCLE`             | ops depend on each other in a loop (incl. self)   | ids in the cycle    |
| `UNRECOGNIZED_TYPE` | type not in the known list                        | `[opId]`            |

If any of `EMPTY`, `DUPLICATE_ID`, `INVALID_AFTER` or `CYCLE` is found, ordering can't be trusted: `check()` returns only the warnings and **skips all rules**. A result with only warnings is not a pass. `UNRECOGNIZED_TYPE` does not skip the rules.

## Examples (`examples/`, named by part number)

| File                      | Rules       | Expected                                               |
| ------------------------- | ----------- | ------------------------------------------------------ |
| `BRKT-2201.json` | base | `ORDER_BEFORE` [op20, op40]: MILL op20 is unordered vs ANODIZE op40 |
| `HSG-0187.json` | base | `FOLLOWED_BY` [op20]: only a visual inspection follows the last MILL |
| `TEST-CLEAN.json` | base | `[]`                                                   |
| `TEST-CUSTB-PASS.json`    | base + B    | `[]`: two visual inspections                          |
| `TEST-CUSTB-FAIL.json`    | base + B    | `MIN_COUNT` [op40]: one visual inspection             |
| `TEST-EMPTY.json` | base | `EMPTY`                                                |
| `TEST-DUPLICATE-ID.json` | base | `DUPLICATE_ID` [op20]                                  |
| `TEST-INVALID-AFTER.json` | base | `INVALID_AFTER` [op20, op99]                           |
| `TEST-CYCLE.json` | base | `CYCLE` [op20, op30]                                   |
| `TEST-UNKNOWN-TYPE.json` | base | `UNRECOGNIZED_TYPE` [op30], rules still run           |
| `TEST-NO-PACK.json` | base | `MISSING_LAST`                                         |
| `TEST-TWO-PACK.json` | base | `MULTIPLE_LAST` [op40, op50]                           |

## Tests

Vitest, TypeScript, in `test/check.test.ts`. Written before `check()`; the stub throws `not implemented` so every test fails first.

## CLI

```
node src/cli.ts --rules <rules.json> [--rules <more-rules.json>] <routing.json>...
npm run check -- --rules examples/rules/standard.json examples/*.json
```

- `--rules` is required and may be repeated; the files are joined in order. Customer B: `--rules examples/rules/standard.json --rules examples/rules/customer-b.json`.
- One or more routing files. All violations from all routings are printed to stdout, grouped by routing, then a summary line:

```
BRKT-2201 (R-10442): 1 violation
  error    MACHINING_BEFORE_SURFACE   op20, op40   MILL op20 is not guaranteed to run before ANODIZE op40.
TEST-CLEAN (R-T001): OK

1 of 2 routings have violations (1 error, 0 warnings).
```

  Each violation line shows severity, rule id (or the warning code), op ids, and message.
- A routing file that is missing or not valid JSON is reported on stderr; the other routings are still checked. A bad rules file stops the run before anything is checked.
- Exit code: `0` every routing passes, `1` at least one violation (warnings included), `2` usage error or unreadable file.
- Runs on Node 22.18+ directly (no build step).
