# Mock Builder Interview — Hadrian FDE (Part 1, 60 min)

A practice session for Builder Interview Part 1. It's built from the recruiter's description in the [README](README.md#builder-interview-part-1-60-min-microsoft-teams), the [FDE role description](FDE%20Role%20Description.md), and the problem themes candidates report on Glassdoor.

**How to use it:** Have a partner play the Hadrian engineer using the script and the **interviewer-only facts** for one scenario. Don't read those facts yourself first, because the point is to practice pulling them out with questions. If you're practicing alone, use the [solo prompt](#practicing-solo-with-claude) to have Claude play the interviewer. Use the same laptop, tools and Claude Code setup you'll use on the day, and run the full 60 minutes on a timer.

> The scenarios below are invented for practice. They're plausible for a manufacturing software platform, but they are not real Hadrian problems or real Opus features.

---

## What this round is testing

From the recruiter: they present a need or gap in the product, and you decide **together** what to build and how. They're evaluating how you specify and direct the work:

| Signal | What it looks like in the room |
| --- | --- |
| **Need → spec** | You turn a fuzzy request into a short written spec: users, problem, scope, non-goals, acceptance criteria. |
| **Precise enough to direct an agent** | Your prompts name inputs, outputs, data shapes, edge cases and how to verify. The agent's first attempt is close. |
| **Trade-offs under ambiguity** | You state assumptions out loud, pick a direction, and say what you're giving up. You don't stall waiting for perfect info. |
| **Production-grade AI output** | Tests, types, clear structure, error handling. You read what the agent wrote and can explain it. |
| **Team player** | The recruiter flagged this. Treat the interviewer as a partner: check in, ask their opinion, use their domain knowledge. |

This maps to the MTS description: *"You set the intent, build the verification loop, and then unleash agents… You own what your agents produce, end to end."*

---

## Suggested timing

| Min | Segment | Output |
| --- | --- | --- |
| 0–3 | Intro, interviewer presents the need | — |
| 3–15 | Discovery: questions, users, constraints | Notes |
| 15–25 | Write the spec together, agree on the v1 slice | `SPEC.md` |
| 25–50 | Direct the agent to build, verify as you go | Code + tests |
| 50–57 | Demo, walk through trade-offs, next steps | Working demo |
| 57–60 | Your questions, how to package the work | — |

**Biggest risk:** Spending 30 minutes on discovery and never building, or jumping straight to code with no spec. Aim for a written spec by minute 25 at the latest.

---

## Before the day: setup checklist

- [ ] Pick your language and stack now (for example, Python + pytest, or TypeScript + vitest). Don't decide in the room.
- [ ] Have an empty project folder ready with `git init`, a test runner that works, and a short `CLAUDE.md` with your conventions (language, test command, "write tests first", "keep functions small").
- [ ] Confirm Claude Code works with an API key set from the environment (`ANTHROPIC_API_KEY`), so you can drop in Hadrian's key quickly.
- [ ] Know how to save your agent chat log (`/export` in Claude Code) because they may ask for it in the upload.
- [ ] Test screen sharing in Microsoft Teams with your editor and terminal. Bump the font size.
- [ ] Use nothing from a current or former employer: no code, docs, tools, accounts or confidential details.
- [ ] Know the upload format: `LastName_FirstName_Builder_Part1.zip` to the Box link.

---

## The playbook

Use this flow for any scenario.

### 1. Discovery (aim for 6–10 questions)

Ask about these in roughly this order:

1. **Who** feels the pain? Who will use the tool, and how often?
2. **What happens today?** What is the current workaround, and what does it cost when it goes wrong?
3. **What does the data look like?** Ask for a sample. Where does it live, how big is it, how clean is it?
4. **What does "done" mean** for the first version? What would make the user say "this helped"?
5. **Constraints:** systems to integrate with, compliance or audit needs, latency, who maintains it.
6. **What's out of scope?** What would they be fine with us not doing today?

Then **play it back** in 2–3 sentences: "So the core problem is X for Y users. For today, I'd build Z and skip W. Does that match?"

### 2. Spec (keep it to one screen)

Write it in the repo as `SPEC.md`. You can draft it with Claude, but edit it yourself and agree it with the interviewer.

```markdown
# <Feature name>

## Problem
One or two sentences: who has the problem and what it costs.

## Users
Primary user and when they use it.

## Scope for v1
- What it does, as bullet points

## Non-goals
- What we are deliberately not doing today, and why

## Inputs and outputs
Data shapes, with a small example.

## Rules / behavior
Numbered, testable statements.

## Acceptance criteria
- Given <input>, the tool returns <output>
- Edge cases: empty input, bad data, cycles, duplicates…

## Open questions and assumptions
- Assumption: … (confirmed by interviewer / not yet confirmed)

## Later
What v2 would add.
```

### 3. Directing the agent

**Weak prompt:**
> "Build a routing validator."

**Strong prompt:**
> "Read SPEC.md. Implement `validate(routing, rules) -> list[Violation]` in `validator.py`. The routing is a DAG of operations in the JSON shape in the spec. Start by writing pytest tests for acceptance criteria 1–5 in `test_validator.py`, run them to confirm they fail, then implement until they pass. Handle cycles by returning a `CYCLE` violation instead of raising. Don't add a CLI or web UI yet. When you're done, summarize the design in 5 bullets."

What makes it strong: points at the spec, names the files and function signature, says tests first, names the tricky edge case, limits scope, and asks for a summary you can check.

**Habits to show:**
- Work in small steps: data model → core logic + tests → interface → polish.
- Run the tests yourself and read the diff before moving on. Say out loud what you're checking.
- When the agent gets something wrong, fix the **spec or prompt**, not just the code. Narrate that: "It assumed a linear routing, so I'm adding that to the spec."
- Commit after each working step so you can roll back.
- Keep the interviewer involved: "Here's how I'm modeling overrides — does that match how your engineers think about it?"

### 4. Demo and wrap-up

- Show it working on the sample data, including one failure case.
- Name the trade-offs you made and what you'd do next.
- Say how you'd get it into users' hands, for example as a check in the existing authoring screen versus a standalone tool.
- Mention when it should graduate into the platform. Good signals: other programs need it, or the rules are generic.

---

## Scenario A (main): Routing validation

### Interviewer opening

> **Interviewer:** "Our manufacturing engineers write routings in the platform: the sequence of operations a part goes through, like machining, deburr, anodize, inspection, and so on. Last month a customer rejected a lot because a routing had anodize *before* a machining op, and another lot shipped without a required inspection. The customer's quality team is upset. We want to catch these mistakes earlier. Let's figure out what to build."

### Interviewer-only facts (reveal only when asked)

- **Users:** About 15 manufacturing engineers (MEs) write routings. Quality engineers (QEs) own the customer requirements. MEs aren't programmers.
- **Volume:** About 2,000 active routings and about 40 new or edited per week.
- **Data shape:** Routings export as JSON. Operations have `id`, `type` (for example `MILL`, `TURN`, `DEBURR`, `ANODIZE`, `CMM_INSPECT`, `VISUAL_INSPECT`, `PACK`) and `after: [ids]`. **Routings are DAGs, not lists**, because some ops can run in parallel (for example, two machining setups on different machines).
- **Rules differ per customer.** Examples:
  - All machining must happen before any surface treatment (`ANODIZE`, `PAINT`).
  - At least one `CMM_INSPECT` must come after the last machining op.
  - Customer B requires **two** `VISUAL_INSPECT` steps.
  - `PACK` must be last.
- **Today:** A QE reviews routings by eye before release. It takes about 20 minutes each and is often skipped when busy.
- **Overrides:** Sometimes a rule legitimately doesn't apply. QEs need to be able to override with a written reason, and the override must be auditable because aerospace customers audit this.
- **Priority:** Catch errors at release time first. Live feedback while editing is a nice-to-have.
- **False positives** are a real concern. If it cries wolf, MEs will ignore it.

### Curveballs (use one around minute 35)

- "QEs want to add new rules themselves without asking an engineer. How would that change your design?"
- "A routing has a cycle in it because of a data bug. What happens?"
- "Customer C says inspection must happen *within two ops* of the final machining step."

### What a strong session looks like

- Asks early whether routings are linear or a graph, and gets a sample.
- Separates the **rule engine** (generic) from the **rule sets** (per customer, data not code). This is the setup for "QEs can add rules."
- Defines a small, declarative rule format, for example `before(A_types, B_types)`, `count_at_least(type, n)`, `after_last(type_group, type)`, `last(type)`.
- Uses topological order and reachability, not list position, to check "before" on a DAG. Detects cycles and reports them as a violation.
- Returns clear violations: rule, operations involved, and a human-readable message an ME can act on.
- Handles overrides as a record with author, reason and timestamp, even if v1 only stores them in a file.
- Scopes v1 to a function plus CLI (or a tiny API) with tests, and puts live editor feedback in "Later."

### Probing questions the interviewer may ask

- "Why rules as data and not code?"
- "How do you know your 'before' check is right for parallel branches?"
- "How would this plug into the release flow?"
- "If this works for this customer, how does it become a platform feature?"

---

## Scenario B: Tooling library migration

### Interviewer opening

> **Interviewer:** "The CNC tooling library lives in an old SQL Server database with a fixed schema: one wide `tools` table. We keep adding tool types (drills, end mills, inserts, and now additive build plates) that have different attributes, and every new type means a schema change. We're moving to Postgres. Let's design the new model and a migration."

### Interviewer-only facts

- About 12,000 tools. The old `tools` table has about 60 columns, and most are null for any given row. Some attributes are hidden in a free-text `notes` column (for example, "coating: TiAlN").
- Users: CNC programmers look tools up while programming, and the tool crib updates inventory.
- The CAM software reads tool data through a nightly CSV export that **must not break**.
- New tool types show up roughly monthly. Tool engineers, not software engineers, should be able to define them.
- Downtime: the migration can run over a weekend, but the old system must stay readable until cutover.

### What a strong session looks like

- Discusses the options (JSONB attributes plus a JSON Schema per tool type, entity-attribute-value tables, or a table per type) and picks one with a reason. JSONB plus per-type schema validation is usually the best balance here.
- Keeps common, frequently queried fields (ID, type, diameter, length, status) as real columns.
- Plans the migration: map columns → validate against the type's schema → report rows that fail instead of dropping them → parse `notes` carefully and flag low-confidence extractions.
- Protects the CSV export with a compatibility view or a test comparing old and new output.
- Builds a migration script with tests on a small fixture, plus a validation report.

---

## Scenario C: Job lead-time estimate

### Interviewer opening

> **Interviewer:** "Program managers keep asking 'when will this job be done?', and right now someone eyeballs a spreadsheet. We have the routing and how long each op takes. Can we give them a real estimate?"

### Interviewer-only facts

- The routing is a DAG (see Scenario A). Each op has a duration in hours and a machine type.
- Parallel branches can run at the same time **only if** there's a free machine of that type. The shop has, for example, 3 mills, 1 lathe and 1 anodize line, and anodize is outsourced with a fixed 3-day turnaround.
- Program managers want a date and a confidence level, not a Gantt chart. They also want to see **what is driving the date** (the critical path).
- v1 can ignore other jobs competing for machines, but say so.

### What a strong session looks like

- Starts with the critical-path calculation on a DAG with unlimited machines, then adds machine limits as a second step.
- States what's being ignored: shared capacity, shifts and weekends, scrap and rework.
- Output is written for a program manager: an estimated date, the 2–3 ops driving it, and the assumptions.
- Tests include parallel branches, a single machine shared by two branches, and the outsourced fixed-duration step.

---

## Scoring rubric

Have your partner score each 1–4, then compare with your own score.

| Area | 1 | 4 |
| --- | --- | --- |
| Discovery | Started building with no questions | Found the key hidden facts (for example, DAG not list, per-customer rules, overrides) |
| Spec | None, or only in their head | Short, written, agreed, with non-goals and testable criteria |
| Trade-offs | Never said what they skipped | Named assumptions and cuts out loud, checked them with the interviewer |
| Agent direction | Vague prompts, lots of back-and-forth fixing | Specific prompts that pointed at the spec and tests, small steps |
| Verification | Trusted the output | Tests first, ran them, read the diff, could explain every part |
| Collaboration | Monologue | Checked in, used interviewer's domain knowledge, adjusted |
| Result | Nothing working | Working, tested v1 slice with a clear demo and next steps |

---

## Practicing solo with Claude

Paste this into a **separate** Claude chat (not the Claude Code session you're building in):

```text
You are a senior engineer at a manufacturing software company, running a
60-minute collaborative "builder" interview for a Forward Deployed Engineer.
I am the candidate. I'll share my screen in words: I'll paste my questions,
my spec, and summaries of what my coding agent produced.

Rules:
- Open by presenting this need in 3-4 sentences, without details:
  <paste the "Interviewer opening" for one scenario>
- You know these facts, but reveal each one ONLY when my question
  would reasonably surface it. Don't volunteer them:
  <paste that scenario's "Interviewer-only facts">
- Act like a collaborative partner, not an examiner. Give opinions when I
  ask for them. Push back if my scope is too big for an hour.
- Tell me the time every few exchanges (assume ~2 minutes per exchange).
  Around minute 35, introduce one curveball.
- At minute 60, stop and score me with this rubric, with specific evidence:
  <paste the scoring rubric>
```

---

## After each practice run

- How many minutes until you had a written spec?
- Which hidden facts did you miss? Which question would have found them?
- Which agent prompt needed the most rework, and what was missing from it?
- Could you explain every file the agent wrote?
- Did you check in with the interviewer at least every 10 minutes?
- What would you send in the zip: spec, code, tests, chat log export?

---

## Sources

- Recruiter notes and logistics in the [README](README.md)
- [FDE role description](FDE%20Role%20Description.md)
- [Glassdoor — Hadrian interview questions](https://www.glassdoor.com/Interview/Hadrian-Interview-Questions-E5364733.htm) (schema migration, process validation and concurrent graph traversal themes that inspired Scenarios A–C)
