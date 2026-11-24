import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { finishTime, type Op, type Routing, type Machines } from "../src/estimate";

const machines: Machines = JSON.parse(
  readFileSync(new URL("../data/machines.json", import.meta.url), "utf8"),
);
const brkt: Routing = JSON.parse(
  readFileSync(new URL("../data/BRKT-3100.json", import.meta.url), "utf8"),
);

// Mon 2026-11-30 is the reference Monday.
const MON = "2026-11-30";

function op(id: string, machine_type: string, hours: number, after: string[] = []): Op {
  return { id, name: id, machine_type, hours, after };
}

function job(...ops: Op[]): Routing {
  return { job_id: "TEST", ops };
}

const at1 = (r: Routing, release: string, m: Machines = machines) =>
  finishTime(r, m, release, 1);

describe("rule 1: shop calendar", () => {
  it("1. single 1 h op on Monday morning", () => {
    expect(at1(job(op("a", "mill", 1)), `${MON}T06:00`)).toBe(`${MON}T07:00`);
  });

  it("2. 20 h op runs past close into Tuesday", () => {
    expect(at1(job(op("a", "mill", 20)), `${MON}T06:00`)).toBe("2026-12-01T10:00");
  });

  it("3. 20 h op released Friday skips the weekend", () => {
    expect(at1(job(op("a", "mill", 20)), "2026-12-04T06:00")).toBe("2026-12-07T10:00");
  });

  it("4. released Saturday waits for Monday", () => {
    expect(at1(job(op("a", "mill", 1)), "2026-12-05T09:00")).toBe("2026-12-07T07:00");
  });

  it("5. released Monday 23:00 starts Tuesday 06:00", () => {
    expect(at1(job(op("a", "mill", 1)), `${MON}T23:00`)).toBe("2026-12-01T07:00");
  });

  it("6. parallel ops on different machine types overlap", () => {
    const r = job(op("a", "mill", 3), op("b", "lathe", 5));
    expect(at1(r, `${MON}T06:00`)).toBe(`${MON}T11:00`);
  });

  it("7. a chain runs one after the other", () => {
    const r = job(op("a", "mill", 2), op("b", "mill", 3, ["a"]));
    expect(at1(r, `${MON}T06:00`)).toBe(`${MON}T11:00`);
  });
});

describe("rule 2: anodize", () => {
  it("8. arrives after 14:00 Friday: vendor starts Monday 06:00, back Thursday", () => {
    expect(at1(job(op("a", "anodize", 72)), "2026-12-04T17:00")).toBe("2026-12-10T06:00");
  });

  it("8a. arrives Friday at exactly 14:00: waits for Monday 06:00, back Thursday", () => {
    expect(at1(job(op("a", "anodize", 72)), "2026-12-04T14:00")).toBe("2026-12-10T06:00");
  });

  it("8a2. arrives Friday 13:59: starts right away, back Monday", () => {
    expect(at1(job(op("a", "anodize", 72)), "2026-12-04T13:59")).toBe("2026-12-07T13:59");
  });

  it("8b. arrives on the weekend: vendor starts Monday 06:00", () => {
    expect(at1(job(op("a", "anodize", 72)), "2026-12-05T10:00")).toBe("2026-12-10T06:00");
  });

  it("8c. BRKT-3100 released Friday: deburr done 17:00, anodize back Thursday, inspect 06-08", () => {
    expect(at1(brkt, "2026-12-04T06:00")).toBe("2026-12-10T08:00");
  });

  it("9. back on Saturday, next op waits for Monday", () => {
    const r = job(op("a", "anodize", 72), op("b", "cmm", 1, ["a"]));
    expect(at1(r, "2026-12-02T17:00")).toBe("2026-12-07T07:00");
  });

  it("10. back at 22:00 on a weekday, next op starts next morning", () => {
    const r = job(
      op("a", "mill", 16),
      op("b", "anodize", 72, ["a"]),
      op("c", "cmm", 1, ["b"]),
    );
    expect(at1(r, `${MON}T06:00`)).toBe("2026-12-04T07:00");
  });

  it("11. multiplier does not apply to anodize", () => {
    expect(finishTime(job(op("a", "anodize", 72)), machines, `${MON}T06:00`, 1.2)).toBe(
      "2026-12-03T06:00",
    );
  });
});

describe("rule 3: machine counts", () => {
  it("12. two parallel lathe ops can't overlap (1 lathe)", () => {
    const r = job(op("a", "lathe", 3), op("b", "lathe", 3));
    expect(at1(r, `${MON}T06:00`)).toBe(`${MON}T12:00`);
  });

  it("13. three parallel mill ops overlap (3 mills)", () => {
    const r = job(op("a", "mill", 2), op("b", "mill", 2), op("c", "mill", 2));
    expect(at1(r, `${MON}T06:00`)).toBe(`${MON}T08:00`);
  });

  it("14. a fourth parallel mill op waits", () => {
    const r = job(op("a", "mill", 2), op("b", "mill", 2), op("c", "mill", 2), op("d", "mill", 2));
    expect(at1(r, `${MON}T06:00`)).toBe(`${MON}T10:00`);
  });

  it("15. machine counts come from the machines file", () => {
    const r = job(op("a", "mill", 2), op("b", "mill", 2), op("c", "mill", 2), op("d", "mill", 2));
    expect(at1(r, `${MON}T06:00`, { ...machines, mill: 4 })).toBe(`${MON}T08:00`);
  });

  it("16. the op that became ready first gets the machine", () => {
    // A holds the lathe 06:00-10:00. B is ready at 07:00, C at 09:00.
    // C is listed before B, so file order would pick C; ready-first picks B.
    // B is followed by a 10 h mill op, so the finish shows who went first:
    //   B first: B 10-11, B2 11-21, C 11-12 -> 21:00
    //   C first: C 10-11, B 11-12, B2 12-22 -> 22:00
    const r = job(
      op("A", "lathe", 4),
      op("preC", "mill", 3),
      op("C", "lathe", 1, ["preC"]),
      op("preB", "saw", 1),
      op("B", "lathe", 1, ["preB"]),
      op("B2", "mill", 10, ["B"]),
    );
    expect(at1(r, `${MON}T06:00`)).toBe(`${MON}T21:00`);
  });

  // X first: X 06-08, X2 08-18, Y 08-12 -> 18:00
  // Y first: Y 06-10, X 10-12, X2 12-22 -> 22:00
  const tieJob = (jobId: string): Routing => ({
    job_id: jobId,
    ops: [op("X", "lathe", 2), op("X2", "mill", 10, ["X"]), op("Y", "lathe", 4)],
  });

  it("16a. a same-moment tie gives the same result on every run", () => {
    const r = tieJob("TIE-1");
    const first = at1(r, `${MON}T06:00`);
    expect([`${MON}T18:00`, `${MON}T22:00`]).toContain(first);
    for (let i = 0; i < 50; i++) expect(at1(r, `${MON}T06:00`)).toBe(first);
  });

  it("16b. same-moment ties still vary across different routings", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(at1(tieJob(`TIE-${i}`), `${MON}T06:00`));
    expect([...seen].sort()).toEqual([`${MON}T18:00`, `${MON}T22:00`]);
  });

  it("17. two parallel anodize ops overlap (no limit)", () => {
    const r = job(op("a", "anodize", 72), op("b", "anodize", 72));
    expect(at1(r, `${MON}T06:00`)).toBe("2026-12-03T06:00");
  });
});

describe("BRKT-3100 check (rules 4 and 6)", () => {
  const release = `${MON}T06:00`;

  it("18. completion (x1.10) lands on 2026-12-03", () => {
    expect(finishTime(brkt, machines, release, 1.1).slice(0, 10)).toBe("2026-12-03");
  });

  it("19. earliest (x0.80) and latest (x1.20) land on 2026-12-03", () => {
    expect(finishTime(brkt, machines, release, 0.8).slice(0, 10)).toBe("2026-12-03");
    expect(finishTime(brkt, machines, release, 1.2).slice(0, 10)).toBe("2026-12-03");
  });

  it("20. exact finish times at x0.80 / x1.00 / x1.10 / x1.20", () => {
    expect(finishTime(brkt, machines, release, 0.8)).toBe("2026-12-03T16:24");
    expect(finishTime(brkt, machines, release, 1.0)).toBe("2026-12-03T19:00");
    expect(finishTime(brkt, machines, release, 1.1)).toBe("2026-12-03T20:18");
    expect(finishTime(brkt, machines, release, 1.2)).toBe("2026-12-03T21:36");
  });
});
