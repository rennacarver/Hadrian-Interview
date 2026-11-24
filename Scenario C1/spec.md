# Spec: Job Completion Date Estimator (v1)

## Problem

Program managers keep asking "when will this job be done?" Today someone opens a spreadsheet and eyeballs it, and the answer depends on who you ask. Two failure modes:

- **Too pessimistic.** BRKT-3100 was estimated at two weeks and took ~90 hours. The spreadsheet padded heavily *and* added every op end to end, even though some ops run in parallel.
- **Unexplained slips.** When a job runs past its estimate, nobody can tell the PM why.

We have the routing for every job and rough hours per operation. v1 turns that into a date, a confidence range, and plain-English reasons.

## Scope

One function (plus one helper exported for tests). Nothing else.

**In:** a routing file (JSON), a machines file (JSON), and the time the job is released to the floor.
**Out:** an estimated completion date, a ±20% date range, plain-English reasons, and warnings.

**Stack:** TypeScript, tested with Vitest.

### Out of scope for v1 (do not build)

- Other jobs competing for machines. **v1 assumes this job has the whole shop floor to itself**: every machine is free for it, but it is still limited by how many machines of each type exist (rule 3).
- Unattended / lights-out running (v2).
- Holidays.
- Variable anodize turnaround, multiple vendors, shipping cutoffs.
- Time zones. All times are shop-local.
- UI, API, database, CLI.

## Inputs

### Routing file

```json
{
  "job_id": "BRKT-3100",
  "ops": [
    { "id": "op10", "name": "Saw cut stock", "machine_type": "saw",     "hours": 1,  "after": [] },
    { "id": "op20", "name": "Mill side A",   "machine_type": "mill",    "hours": 4,  "after": ["op10"] },
    { "id": "op30", "name": "Turn boss",     "machine_type": "lathe",   "hours": 3,  "after": ["op10"] },
    { "id": "op40", "name": "Mill side B",   "machine_type": "mill",    "hours": 5,  "after": ["op20"] },
    { "id": "op50", "name": "Deburr",        "machine_type": "bench",   "hours": 1,  "after": ["op40", "op30"] },
    { "id": "op60", "name": "Anodize",       "machine_type": "anodize", "hours": 72, "after": ["op50"] },
    { "id": "op70", "name": "Final inspect", "machine_type": "cmm",     "hours": 2,  "after": ["op60"] }
  ]
}
```

- `after` lists the ops that must finish before this op can start.
- An op with `machine_type: "anodize"` is out of house (rule 2). Every other op is in house.

### Machines file

How many machines of each in-house type the shop has. Swap the file to model a different floor.

```json
{
  "mill": 3,
  "lathe": 1,
  "saw": 1,
  "bench": 2,
  "cmm": 1
}
```

`anodize` is not listed. It is outsourced, with no limit on parts out at once.

### Release time

A shop-local date-time string, `"YYYY-MM-DDTHH:mm"` (e.g. `"2026-11-30T06:00"`), when the job is released to the floor. Required, because the output is a calendar date. Results must not depend on the time zone of the computer running the code.

## Output

```ts
estimateCompletion(routingPath: string, machinesPath: string, release: string): Estimate

interface Estimate {
  jobId: string;        // "BRKT-3100"
  completion: string;   // "2026-12-03"  point estimate, includes the 10% buffer
  earliest: string;     // "2026-12-03"  -20%
  latest: string;       // "2026-12-03"  +20%
  confidence: "±20%";
  reasons: string[];    // plain English, see rule 7
  warnings: string[];   // empty when the routing is clean, see rule 8
}
```

Dates are `"YYYY-MM-DD"`, with no time.

### Test helper

```ts
finishTime(routing: Routing, machines: Machines, release: string, multiplier: number): string
// returns "YYYY-MM-DDTHH:mm"
```

Runs the schedule with every in-house op's hours × `multiplier` and returns the exact finish time. `estimateCompletion` is built on it. It is exported so tests can check the calendar rules to the minute, which a date-only output can't show.

## Rules

### 1. Shop calendar (in-house ops)

- Open **Monday–Friday, 06:00–22:00** (16 hours/day). Closed nights and weekends.
- In-house ops only progress while the shop is open. An op that isn't done at 22:00 picks up at 06:00 the next open day.
- If an op becomes ready while the shop is closed, it starts at the next opening.

### 2. Anodize (out of house, fixed)

- Always **72 calendar hours**, straight through nights and weekends.
- **Fixed.** The 10% buffer and the ±20% range do not apply to it.
- It ships the moment its predecessors finish, and the vendor starts right away, **except**:
- **Vendor cutoff:** parts that arrive at **14:00 Friday or later**, or on Saturday or Sunday, aren't started until **Monday 06:00**, so they come back Thursday 06:00. A part arriving at 13:59 Friday starts right away and is back Monday 13:59.
- If it comes back while the shop is closed, the next op waits for the shop to open.

### 3. Parallel ops and machine counts

An op is **ready** when **all** ops in its `after` list are done. Ready ops on different branches can overlap, but only if a machine of that type is free (counts come from the machines file).

- An op holds one machine of its type from start to finish, including across nights and weekends.
- If a ready op has no free machine, it waits until one frees up. Example: two lathe ops on parallel branches can't overlap; one waits for the other.
- When several ops are waiting for the same machine type, **the one that became ready first goes first**. If they became ready at the same moment, pick one at random, using randomness seeded from the routing's contents. The same routing always gives the same pick, so running the estimate twice gives the same answer.
- The job finishes when the last op finishes. The longest chain, plus any waiting for machines, sets the date, not the sum of all ops.

### 4. Overestimate by a bit

`completion` uses every in-house op's hours × **1.10**. Anodize stays at 72 hours.

### 5. Confidence ±20%

- `earliest`: in-house hours × **0.80**.
- `latest`: in-house hours × **1.20**.
- Anodize stays at 72 hours in both.
- `confidence` is the fixed string `"±20%"` in v1.

The point estimate always falls inside the range.

### 6. Time precision

Work in whole minutes internally. Round each scaled op duration **up** to the next whole minute. Only the final output is cut down to a date.

### 7. Plain-English reasons

A list of short sentences a PM can read. Include, when they apply:

| Situation | Example reason |
|---|---|
| Always | "The longest chain of work is Saw cut stock → Mill side A → Mill side B → Deburr → Anodize → Final inspect." |
| Routing has anodize | "Anodize is done out of house and takes 3 calendar days, including weekends." |
| An op runs in parallel and is not on the longest chain | "Turn boss runs at the same time as Mill side A, so it doesn't add time." |
| An op waited for a machine | "Turn flange waits 3 hours for the lathe, because the shop has only one." |
| The schedule waits on nights/weekends | "The shop is closed nights and weekends, which adds 13 hours of waiting." |
| Always | "Includes a 10% buffer on in-house work." |
| Always | "Assumes no other jobs are using the machines. If they are, this job will finish later." |

### 8. Bad routing: warn, still estimate

Never throw on a bad routing. Add a plain-English line to `warnings`, apply the fallback below, and return an estimate.

| Problem | Fallback | Example warning |
|---|---|---|
| `ops` is empty | All three dates are the release date | "The routing has no operations." |
| Two ops share an `id` | Keep the first, ignore the later one | "op20 appears twice. Only the first one was used." |
| `after` names an op that doesn't exist | Ignore that dependency | "op40 depends on op99, which isn't in the routing. That dependency was ignored." |
| Dependencies form a loop | Drop every op in the loop. Ops that depend on a dropped op ignore that dependency | "op20, op40 depend on each other in a loop. They were left out of the estimate." |
| `hours` missing, zero or negative | Treat as 0 hours | "op30 has no valid hours. It was counted as 0." |
| `machine_type` not in the machines file (and not `anodize`) | Assume 1 machine of that type | "op30 uses 'edm', which isn't in the machines file. Assumed 1 machine." |

The machines file and file reading itself are not covered by this rule. A missing or unreadable file is an error.

## Worked check: BRKT-3100

Release **Monday 2026-11-30 06:00**.

| Op | ×1.00 | ×1.10 (estimate) |
|---|---|---|
| op10 Saw | Mon 06:00–07:00 | Mon 06:00–07:06 |
| op20 Mill A | Mon 07:00–11:00 | Mon 07:06–11:30 |
| op30 Turn (parallel) | Mon 07:00–10:00 | Mon 07:06–10:24 |
| op40 Mill B | Mon 11:00–16:00 | Mon 11:30–17:00 |
| op50 Deburr | Mon 16:00–17:00 | Mon 17:00–18:06 |
| op60 Anodize (fixed 72 h) | Mon 17:00 → Thu 17:00 | Mon 18:06 → Thu 18:06 |
| op70 Inspect | Thu 17:00–19:00 | Thu 18:06–20:18 |

| Multiplier | Finish time | Output date |
|---|---|---|
| ×0.80 (earliest) | 2026-12-03T16:24 | 2026-12-03 |
| ×1.00 | 2026-12-03T19:00 | — |
| ×1.10 (completion) | 2026-12-03T20:18 | 2026-12-03 |
| ×1.20 (latest) | 2026-12-03T21:36 | 2026-12-03 |

No machine waits: Mill side A and Mill side B are sequential, and Turn boss is the only lathe op.

The real run took 90 hours (2026-12-03 12:00 if released at this time), the same day. The old spreadsheet said two weeks. The real run also lost 4 hours waiting for a mill because other jobs were using them; v1 doesn't model that.

## Tests (write first; all must fail before implementing)

All times shop-local. "Mon" = 2026-11-30 unless stated. Tests 1–10 use `finishTime` at ×1.00 with the standard machines file.

**Shop calendar**

1. Single 1 h op released Mon 06:00 → `2026-11-30T07:00`.
2. Single 20 h op released Mon 06:00 → runs past close → `2026-12-01T10:00`.
3. Single 20 h op released Fri 2026-12-04 06:00 → skips the weekend → `2026-12-07T10:00`.
4. Single 1 h op released Sat 2026-12-05 09:00 → waits for Monday → `2026-12-07T07:00`.
5. Single 1 h op released Mon 23:00 → `2026-12-01T07:00`.
6. Two parallel ops on different machine types (3 h mill, 5 h lathe) released Mon 06:00 → `2026-11-30T11:00`.
7. A chain (2 h → 3 h) released Mon 06:00 → `2026-11-30T11:00`.

**Anodize**

8. Anodize arrives Fri 2026-12-04 17:00 (after cutoff) → vendor starts Mon 06:00 → back `2026-12-10T06:00`.
8a. Anodize arrives Fri 2026-12-04 14:00 exactly → waits for Mon 06:00 → back `2026-12-10T06:00`.
8a2. Anodize arrives Fri 2026-12-04 13:59 → starts right away → back `2026-12-07T13:59`.
8b. Anodize arrives Sat 2026-12-05 10:00 → vendor starts Mon 06:00 → back `2026-12-10T06:00`.
8c. BRKT-3100 released Fri 2026-12-04 06:00 → deburr done 17:00 → anodize back Thu 06:00 → inspect done `2026-12-10T08:00`.
9. Anodize ships Wed 2026-12-02 17:00 → back Sat 17:00 → next 1 h op finishes `2026-12-07T07:00`.
10. 16 h op (Mon 06:00–22:00) → anodize back Thu 22:00 → next 1 h op finishes `2026-12-04T07:00`.
11. `finishTime` with ×1.20 on a lone anodize op still returns exactly 72 h later.

**Machine counts**

12. Two parallel 3 h lathe ops released Mon 06:00 → can't overlap → `2026-11-30T12:00`.
13. Three parallel 2 h mill ops released Mon 06:00 → all overlap → `2026-11-30T08:00`.
14. Four parallel 2 h mill ops released Mon 06:00 → the last one in the file waits → `2026-11-30T10:00`.
15. Same as 14 with a machines file of `"mill": 4` → `2026-11-30T08:00` (the file is actually used).
16. Ready-first wins: lathe op A ready at 06:00 runs 06:00–10:00; lathe op B (ready 07:00) and lathe op C (ready 09:00, listed before B in the file) both wait; B runs next.
16a. Same-moment tie: two lathe ops ready at Mon 06:00: X (2 h, followed by a 10 h mill op) and Y (4 h, nothing after it). If X goes first the finish is `2026-11-30T18:00`; if Y goes first it is `2026-11-30T22:00`. The same routing run 50 times always gives the same one of those two.
16b. The same tie across 50 routings that differ only in `job_id` → both finish times appear, so the pick is still random across routings.
17. Two parallel anodize ops → overlap (no limit).

**BRKT-3100 via `estimateCompletion`**

18. `completion` = `2026-12-03`.
19. `earliest` = `2026-12-03`; `latest` = `2026-12-03`.
20. `finishTime` at ×0.80 / ×1.10 / ×1.20 = `2026-12-03T16:24` / `T20:18` / `T21:36`.
21. (Moved to 8c: the vendor cutoff changed the answer.)
22. `confidence` == `"±20%"`; `warnings` is empty.

**Reasons**

23. Reasons name every op on the longest chain, in order.
24. Reasons mention anodize being out of house and taking 3 calendar days.
25. Reasons say Turn boss runs in parallel and doesn't add time.
26. Reasons mention the 10% buffer and the no-other-jobs assumption.
27. In test 12's routing, the lathe op that waited gets a "waits … for the lathe" reason.
28. A routing with no anodize, no machine waits and no closed-shop waiting has none of those three reasons.

**Bad routing (warn, still estimate)**

29. Empty `ops` → all dates = release date, one warning.
30. Duplicate op `id` → first one used, one warning.
31. `after` names an unknown op → dependency ignored, one warning.
32. Dependency loop: op10 (1 h) → op20 ⇄ op40 (loop) → op50 (1 h, after op40) released Mon 06:00 → op20 and op40 dropped, op50 runs after op10 only → ×1.00 finish `2026-11-30T08:00`, one warning naming op20 and op40.
33. `hours` ≤ 0 or missing → counted as 0, one warning.
34. Unknown `machine_type` → treated as 1 machine, one warning.

**Files**

35. Reading BRKT-3100 and the machines file from disk gives the result in test 18.
36. Missing routing or machines file → throws.

## Known consequence

Tie-break randomness is seeded from the routing, so any change to the routing file can flip a tie. That includes a rename or reordering that doesn't change the work. This only matters when two ops wait for the same machine type and became ready at the same moment. BRKT-3100 has no such tie.
