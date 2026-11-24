import { describe, expect, it } from "vitest";
import { check } from "../src/check";
import type { Operation, Routing, Rule, Violation } from "../src/types";

import standardJson from "../examples/rules/standard.json";
import customerBJson from "../examples/rules/customer-b.json";

import BRKT_2201 from "../examples/BRKT-2201.json";
import HSG_0187 from "../examples/HSG-0187.json";
import CLEAN from "../examples/TEST-CLEAN.json";
import CUSTB_PASS from "../examples/TEST-CUSTB-PASS.json";
import CUSTB_FAIL from "../examples/TEST-CUSTB-FAIL.json";
import EMPTY from "../examples/TEST-EMPTY.json";
import DUPLICATE_ID from "../examples/TEST-DUPLICATE-ID.json";
import INVALID_AFTER from "../examples/TEST-INVALID-AFTER.json";
import CYCLE from "../examples/TEST-CYCLE.json";
import UNKNOWN_TYPE from "../examples/TEST-UNKNOWN-TYPE.json";
import NO_PACK from "../examples/TEST-NO-PACK.json";
import TWO_PACK from "../examples/TEST-TWO-PACK.json";

// --- helpers ---------------------------------------------------------------

const STANDARD = standardJson as Rule[];
// Customer rule files hold only additions; the caller combines them with the base set.
const CUSTOMER_B = [...STANDARD, ...(customerBJson as Rule[])];

const op = (id: string, type: string, after: string[] = []): Operation => ({ id, type, after });

const routing = (operations: Operation[], customer = "Customer A"): Routing => ({
  routing_id: "R-TEST",
  part: "TEST-PART",
  customer,
  operations,
});

/** Order-insensitive summary: "CODE:op_a,op_b" per violation, sorted. Message text is not part of the contract. */
const summarize = (violations: Violation[]) =>
  violations.map((v) => `${v.code}:${v.op_ids.join(",")}`).sort();

const run = (r: unknown, rules: Rule[] = STANDARD) => summarize(check(r as Routing, rules));

// --- example files -----------------------------------------------------------

describe("example routings", () => {
  it("BRKT-2201: MILL op20 is unordered vs ANODIZE op40", () => {
    expect(run(BRKT_2201)).toEqual(["ORDER_BEFORE:op20,op40"]);
  });

  it("HSG-0187: no CMM_INSPECT after the last MILL (visual doesn't count)", () => {
    expect(run(HSG_0187)).toEqual(["FOLLOWED_BY:op20"]);
  });

  it("TEST-CLEAN passes", () => {
    expect(run(CLEAN)).toEqual([]);
  });

  it("TEST-CUSTB-PASS: two visual inspections pass Customer B rules", () => {
    expect(run(CUSTB_PASS, CUSTOMER_B)).toEqual([]);
  });

  it("TEST-CUSTB-FAIL: one visual inspection fails Customer B rules", () => {
    expect(run(CUSTB_FAIL, CUSTOMER_B)).toEqual(["MIN_COUNT:op40"]);
  });

  it("TEST-EMPTY", () => {
    expect(run(EMPTY)).toEqual(["EMPTY:"]);
  });

  it("TEST-DUPLICATE-ID", () => {
    expect(run(DUPLICATE_ID)).toEqual(["DUPLICATE_ID:op20"]);
  });

  it("TEST-INVALID-AFTER", () => {
    expect(run(INVALID_AFTER)).toEqual(["INVALID_AFTER:op20,op99"]);
  });

  it("TEST-CYCLE", () => {
    const result = check(CYCLE as Routing, STANDARD);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("CYCLE");
    expect([...result[0].op_ids].sort()).toEqual(["op20", "op30"]);
  });

  it("TEST-UNKNOWN-TYPE: warns, rules still pass", () => {
    expect(run(UNKNOWN_TYPE)).toEqual(["UNRECOGNIZED_TYPE:op30"]);
  });

  it("TEST-NO-PACK", () => {
    expect(run(NO_PACK)).toEqual(["MISSING_LAST:"]);
  });

  it("TEST-TWO-PACK", () => {
    expect(run(TWO_PACK)).toEqual(["MULTIPLE_LAST:op40,op50"]);
  });
});

// --- output shape ------------------------------------------------------------

describe("output", () => {
  it("each violation carries routing_id, part, rule id, code, severity and a message", () => {
    const [v] = check(BRKT_2201 as Routing, STANDARD);
    expect(v).toMatchObject({
      routing_id: "R-10442",
      part: "BRKT-2201",
      rule: "MACHINING_BEFORE_SURFACE",
      code: "ORDER_BEFORE",
      severity: "error",
      op_ids: ["op20", "op40"],
    });
    expect(typeof v.message).toBe("string");
    expect(v.message.length).toBeGreaterThan(0);
  });

  it("rule violations are errors; malformed input is a warning with rule: null", () => {
    for (const v of check(HSG_0187 as Routing, STANDARD)) expect(v.severity).toBe("error");
    for (const r of [EMPTY, DUPLICATE_ID, INVALID_AFTER, CYCLE, UNKNOWN_TYPE]) {
      for (const v of check(r as Routing, STANDARD)) {
        expect(v.severity).toBe("warning");
        expect(v.rule).toBeNull();
      }
    }
  });
});

// --- rules are passed in, not hardcoded --------------------------------------

describe("rules come from the caller", () => {
  it("an empty rule list checks nothing but input", () => {
    expect(run(BRKT_2201, [])).toEqual([]);
    expect(run(HSG_0187, [])).toEqual([]);
    expect(run(EMPTY, [])).toEqual(["EMPTY:"]);
  });

  it("the routing's customer field does not pick rules", () => {
    // Customer B routing checked with standard rules: no visual-count rule
    expect(run(CUSTB_FAIL, STANDARD)).toEqual([]);
  });

  it("ORDER_BEFORE works with any types", () => {
    const rules: Rule[] = [{ id: "CMM_BEFORE_PAINT", kind: "ORDER_BEFORE", first: ["CMM_INSPECT"], then: ["PAINT"] }];
    const r = routing([op("op10", "MILL"), op("op20", "PAINT", ["op10"]), op("op30", "CMM_INSPECT", ["op20"])]);
    const result = check(r, rules);
    expect(summarize(result)).toEqual(["ORDER_BEFORE:op30,op20"]);
    expect(result[0].rule).toBe("CMM_BEFORE_PAINT");
  });

  it("FOLLOWED_BY accepts any of the `requires` types", () => {
    const rules: Rule[] = [
      { id: "INSPECT_AFTER_PAINT", kind: "FOLLOWED_BY", targets: ["PAINT"], requires: ["VISUAL_INSPECT", "CMM_INSPECT"] },
    ];
    expect(run(routing([op("op10", "PAINT"), op("op20", "CMM_INSPECT", ["op10"])]), rules)).toEqual([]);
    expect(run(routing([op("op10", "PAINT"), op("op20", "VISUAL_INSPECT", ["op10"])]), rules)).toEqual([]);
    expect(run(routing([op("op10", "PAINT")]), rules)).toEqual(["FOLLOWED_BY:op10"]);
  });

  it("MIN_COUNT counts across all listed types, ids in input order", () => {
    const rules: Rule[] = [{ id: "THREE_INSPECTIONS", kind: "MIN_COUNT", types: ["CMM_INSPECT", "VISUAL_INSPECT"], min: 3 }];
    const r = routing([op("op10", "CMM_INSPECT"), op("op20", "VISUAL_INSPECT", ["op10"])]);
    expect(run(r, rules)).toEqual(["MIN_COUNT:op10,op20"]);
  });

  it("LAST works with any type", () => {
    const rules: Rule[] = [{ id: "CMM_LAST", kind: "LAST", type: "CMM_INSPECT" }];
    expect(run(routing([op("op10", "MILL"), op("op20", "CMM_INSPECT", ["op10"])]), rules)).toEqual([]);
    expect(run(routing([op("op10", "CMM_INSPECT"), op("op20", "MILL", ["op10"])]), rules)).toEqual([
      "NOT_LAST:op20,op10",
    ]);
  });

  it("two rules of the same kind are reported separately, each with its own id", () => {
    const rules: Rule[] = [
      { id: "TWO_CMM", kind: "MIN_COUNT", types: ["CMM_INSPECT"], min: 2 },
      { id: "TWO_VISUAL", kind: "MIN_COUNT", types: ["VISUAL_INSPECT"], min: 2 },
    ];
    const result = check(routing([op("op10", "MILL")]), rules);
    expect(result.map((v) => v.rule).sort()).toEqual(["TWO_CMM", "TWO_VISUAL"]);
  });
});

// --- current rule: machining before surfacing ---------------------------------

describe("MACHINING_BEFORE_SURFACE (standard rules)", () => {
  it("flags machining that comes after surfacing", () => {
    const r = routing([
      op("op10", "ANODIZE"),
      op("op20", "MILL", ["op10"]),
      op("op30", "CMM_INSPECT", ["op20"]),
      op("op40", "PACK", ["op30"]),
    ]);
    expect(run(r)).toEqual(["ORDER_BEFORE:op20,op10"]);
  });

  it("covers TURN and DRILL, and PAINT", () => {
    const r = routing([
      op("op10", "PAINT"),
      op("op20", "TURN", ["op10"]),
      op("op30", "DRILL", ["op20"]),
      op("op40", "CMM_INSPECT", ["op30"]),
      op("op50", "PACK", ["op40"]),
    ]);
    expect(run(r)).toEqual(["ORDER_BEFORE:op20,op10", "ORDER_BEFORE:op30,op10"]);
  });

  it("DEBURR is not machining: it may come after surfacing", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "ANODIZE", ["op20"]),
      op("op40", "DEBURR", ["op30"]),
      op("op50", "PACK", ["op40"]),
    ]);
    expect(run(r)).toEqual([]);
  });

  it("one violation per (machining, surfacing) pair", () => {
    // op10 MILL is unordered vs both surfacing ops
    const r = routing([
      op("op10", "MILL"),
      op("op20", "PAINT"),
      op("op30", "ANODIZE"),
      op("op40", "CMM_INSPECT", ["op10", "op20", "op30"]),
      op("op50", "PACK", ["op40"]),
    ]);
    expect(run(r)).toEqual(["ORDER_BEFORE:op10,op20", "ORDER_BEFORE:op10,op30"]);
  });

  it("uses transitive ordering, not just direct `after`", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "VISUAL_INSPECT", ["op20"]),
      op("op40", "ANODIZE", ["op30"]),
      op("op50", "PACK", ["op40"]),
    ]);
    expect(run(r)).toEqual([]);
  });

  it("ignores array order", () => {
    const r = routing([
      op("op50", "PACK", ["op40"]),
      op("op40", "CMM_INSPECT", ["op30"]),
      op("op30", "ANODIZE", ["op10"]),
      op("op10", "MILL"),
    ]);
    expect(run(r)).toEqual([]);
  });
});

// --- current rule: CMM after machining ------------------------------------------

describe("CMM_AFTER_MACHINING (standard rules)", () => {
  it("passes with no machining and no inspection", () => {
    const r = routing([op("op10", "PAINT"), op("op20", "PACK", ["op10"])]);
    expect(run(r)).toEqual([]);
  });

  it("VISUAL_INSPECT does not satisfy it", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "VISUAL_INSPECT", ["op10"]),
      op("op30", "PACK", ["op20"]),
    ]);
    expect(run(r)).toEqual(["FOLLOWED_BY:op10"]);
  });

  it("a CMM before the last machining op doesn't count", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "DRILL", ["op20"]),
      op("op40", "PACK", ["op30"]),
    ]);
    expect(run(r)).toEqual(["FOLLOWED_BY:op30"]);
  });

  it("DEBURR after the CMM doesn't need another CMM", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "DEBURR", ["op20"]),
      op("op40", "PACK", ["op30"]),
    ]);
    expect(run(r)).toEqual([]);
  });

  it("flags only machining ops that could run last", () => {
    // op10 -> op20 -> op30 machining chain, nothing inspects: only op30 reported
    const r = routing([
      op("op10", "TURN"),
      op("op20", "MILL", ["op10"]),
      op("op30", "DRILL", ["op20"]),
      op("op40", "PACK", ["op30"]),
    ]);
    expect(run(r)).toEqual(["FOLLOWED_BY:op30"]);
  });

  it("a parallel machining branch needs its own CMM after it", () => {
    // op20 MILL could run after the CMM on op10's branch
    const r = routing([
      op("op10", "MILL"),
      op("op20", "MILL"),
      op("op30", "CMM_INSPECT", ["op10"]),
      op("op40", "PACK", ["op30", "op20"]),
    ]);
    expect(run(r)).toEqual(["FOLLOWED_BY:op20"]);
  });

  it("one CMM after both parallel branches passes", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "TURN"),
      op("op30", "CMM_INSPECT", ["op10", "op20"]),
      op("op40", "PACK", ["op30"]),
    ]);
    expect(run(r)).toEqual([]);
  });
});

// --- current rule: Customer B needs two visual inspections -----------------------

describe("TWO_VISUAL_INSPECTIONS (Customer B rules)", () => {
  const withVisuals = (visuals: number): Routing => {
    const ops = [op("op10", "MILL"), op("op20", "CMM_INSPECT", ["op10"])];
    let prev = "op20";
    for (let i = 0; i < visuals; i++) {
      const id = `v${i + 1}`;
      ops.push(op(id, "VISUAL_INSPECT", [prev]));
      prev = id;
    }
    ops.push(op("op90", "PACK", [prev]));
    return routing(ops, "Customer B");
  };

  it("zero visual inspections", () => {
    expect(run(withVisuals(0), CUSTOMER_B)).toEqual(["MIN_COUNT:"]);
  });

  it("one visual inspection", () => {
    expect(run(withVisuals(1), CUSTOMER_B)).toEqual(["MIN_COUNT:v1"]);
  });

  it("two or more visual inspections pass", () => {
    expect(run(withVisuals(2), CUSTOMER_B)).toEqual([]);
    expect(run(withVisuals(3), CUSTOMER_B)).toEqual([]);
  });

  it("position doesn't matter, only the count", () => {
    const r = routing(
      [
        op("v1", "VISUAL_INSPECT"),
        op("op10", "MILL", ["v1"]),
        op("v2", "VISUAL_INSPECT", ["op10"]),
        op("op20", "CMM_INSPECT", ["v2"]),
        op("op30", "PACK", ["op20"]),
      ],
      "Customer B",
    );
    expect(run(r, CUSTOMER_B)).toEqual([]);
  });

  it("is not in the standard rules", () => {
    expect(run(withVisuals(0), STANDARD)).toEqual([]);
  });

  it("Customer B still needs a CMM after machining", () => {
    const r = routing(
      [
        op("op10", "MILL"),
        op("v1", "VISUAL_INSPECT", ["op10"]),
        op("v2", "VISUAL_INSPECT", ["v1"]),
        op("op20", "PACK", ["v2"]),
      ],
      "Customer B",
    );
    expect(run(r, CUSTOMER_B)).toEqual(["FOLLOWED_BY:op10"]);
  });
});

// --- current rule: pack last ---------------------------------------------------

describe("PACK_LAST (standard rules)", () => {
  it("MISSING_LAST when there is no PACK", () => {
    const r = routing([op("op10", "MILL"), op("op20", "CMM_INSPECT", ["op10"])]);
    expect(run(r)).toEqual(["MISSING_LAST:"]);
  });

  it("NOT_LAST for an op that comes after PACK", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "PACK", ["op20"]),
      op("op40", "VISUAL_INSPECT", ["op30"]),
    ]);
    expect(run(r)).toEqual(["NOT_LAST:op40,op30"]);
  });

  it("NOT_LAST for an op unordered vs PACK", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "VISUAL_INSPECT"),
      op("op40", "PACK", ["op20"]),
    ]);
    expect(run(r)).toEqual(["NOT_LAST:op30,op40"]);
  });

  it("MULTIPLE_LAST, with no NOT_LAST between the packs themselves", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "PACK", ["op20"]),
      op("op40", "PACK", ["op20"]),
    ]);
    expect(run(r)).toEqual(["MULTIPLE_LAST:op30,op40"]);
  });

  it("unrecognized ops still have to come before PACK", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "PACK", ["op20"]),
      op("op40", "LASER_MARK", ["op30"]),
    ]);
    expect(run(r)).toEqual(["NOT_LAST:op40,op30", "UNRECOGNIZED_TYPE:op40"]);
  });
});

// --- malformed input -----------------------------------------------------------

describe("malformed input", () => {
  it("EMPTY when operations is missing", () => {
    const { operations: _, ...r } = routing([]);
    expect(run(r)).toEqual(["EMPTY:"]);
  });

  it("self-reference is a CYCLE", () => {
    const r = routing([
      op("op10", "MILL", ["op10"]),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "PACK", ["op20"]),
    ]);
    expect(run(r)).toEqual(["CYCLE:op10"]);
  });

  it("structural warnings skip all rules", () => {
    // Would break all three standard rules if they ran
    const r = routing([op("op10", "ANODIZE"), op("op20", "MILL", ["op10", "op99"])]);
    expect(run(r)).toEqual(["INVALID_AFTER:op20,op99"]);
  });

  it("reports every structural problem found", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10", "op99"]),
      op("op30", "PACK", ["op20"]),
    ]);
    expect(run(r)).toEqual(["DUPLICATE_ID:op10", "INVALID_AFTER:op20,op99"]);
  });

  it("type matching is case-sensitive", () => {
    const r = routing([
      op("op10", "MILL"),
      op("op20", "CMM_INSPECT", ["op10"]),
      op("op30", "pack", ["op20"]),
    ]);
    expect(run(r)).toEqual(["MISSING_LAST:", "UNRECOGNIZED_TYPE:op30"]);
  });
});
