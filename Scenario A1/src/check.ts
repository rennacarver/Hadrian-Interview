import { KNOWN_TYPES } from "./types.ts";
import type { Operation, Routing, Rule, Violation, ViolationCode } from "./types.ts";

const KNOWN = new Set<string>(KNOWN_TYPES);

/** Input problems that make ordering untrustworthy: rules are skipped if any is found. */
const STRUCTURAL: ReadonlySet<ViolationCode> = new Set(["EMPTY", "DUPLICATE_ID", "INVALID_AFTER", "CYCLE"]);

export function check(routing: Routing, rules: Rule[]): Violation[] {
  const ops = routing.operations ?? [];
  const out: Violation[] = [];

  const warn = (code: ViolationCode, op_ids: string[], message: string) =>
    out.push({ routing_id: routing.routing_id, part: routing.part, rule: null, code, severity: "warning", op_ids, message });

  // --- malformed input ------------------------------------------------------

  if (ops.length === 0) {
    warn("EMPTY", [], "Routing has no operations.");
    return out;
  }

  const ids = new Set(ops.map((o) => o.id));

  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const o of ops) {
    if (seen.has(o.id) && !reported.has(o.id)) {
      warn("DUPLICATE_ID", [o.id], `Operation id ${o.id} is used more than once.`);
      reported.add(o.id);
    }
    seen.add(o.id);
  }

  // Dependencies by id; ids shared by duplicates merge their `after` lists. Invalid refs are dropped.
  const deps = new Map<string, string[]>();
  for (const id of ids) deps.set(id, []);
  for (const o of ops) {
    for (const ref of o.after) {
      if (ids.has(ref)) deps.get(o.id)!.push(ref);
      else warn("INVALID_AFTER", [o.id, ref], `${o.id} runs after ${ref}, which does not exist.`);
    }
  }

  for (const cycle of findCycles(deps)) {
    warn("CYCLE", cycle, `Operations ${cycle.join(", ")} depend on each other in a loop.`);
  }

  for (const o of ops) {
    if (!KNOWN.has(o.type)) warn("UNRECOGNIZED_TYPE", [o.id], `${o.id} has unrecognized type ${o.type}.`);
  }

  if (out.some((v) => STRUCTURAL.has(v.code))) return out;

  // --- rules ------------------------------------------------------------------

  const ancestors = ancestorSets(deps);
  const isBefore = (a: string, b: string) => ancestors.get(b)!.has(a);
  const ofTypes = (types: string[]) => ops.filter((o) => types.includes(o.type));

  for (const rule of rules) {
    const fail = (code: ViolationCode, op_ids: string[], message: string) =>
      out.push({ routing_id: routing.routing_id, part: routing.part, rule: rule.id, code, severity: "error", op_ids, message });

    switch (rule.kind) {
      case "ORDER_BEFORE": {
        const thens = ofTypes(rule.then);
        for (const f of ofTypes(rule.first)) {
          for (const t of thens) {
            if (f.id !== t.id && !isBefore(f.id, t.id)) {
              fail("ORDER_BEFORE", [f.id, t.id], `${f.type} ${f.id} is not guaranteed to run before ${t.type} ${t.id}.`);
            }
          }
        }
        break;
      }

      case "FOLLOWED_BY": {
        const targets = ofTypes(rule.targets);
        const required = ofTypes(rule.requires);
        // Targets that could run last: no other target comes after them.
        const couldBeLast = targets.filter((t) => !targets.some((u) => u.id !== t.id && isBefore(t.id, u.id)));
        for (const t of couldBeLast) {
          if (!required.some((r) => isBefore(t.id, r.id))) {
            fail("FOLLOWED_BY", [t.id], `${t.type} ${t.id} has no ${rule.requires.join(" or ")} after it.`);
          }
        }
        break;
      }

      case "MIN_COUNT": {
        const matches = ofTypes(rule.types);
        if (matches.length < rule.min) {
          fail(
            "MIN_COUNT",
            matches.map((o) => o.id),
            `Needs at least ${rule.min} ${rule.types.join("/")} operations, found ${matches.length}.`,
          );
        }
        break;
      }

      case "LAST": {
        const lasts = ops.filter((o) => o.type === rule.type);
        if (lasts.length === 0) {
          fail("MISSING_LAST", [], `No ${rule.type} operation.`);
          break;
        }
        if (lasts.length > 1) {
          fail("MULTIPLE_LAST", lasts.map((o) => o.id), `Expected one ${rule.type} operation, found ${lasts.length}.`);
        }
        const others: Operation[] = ops.filter((o) => o.type !== rule.type);
        for (const last of lasts) {
          for (const o of others) {
            if (!isBefore(o.id, last.id)) {
              fail("NOT_LAST", [o.id, last.id], `${o.type} ${o.id} is not guaranteed to run before ${rule.type} ${last.id}.`);
            }
          }
        }
        break;
      }
    }
  }

  return out;
}

/** Strongly connected components that form a loop (size > 1, or a self-reference). Tarjan's algorithm. */
function findCycles(deps: Map<string, string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  let next = 0;

  const visit = (v: string) => {
    index.set(v, next);
    low.set(v, next);
    next++;
    stack.push(v);
    onStack.add(v);

    for (const w of deps.get(v)!) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }

    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1 || deps.get(v)!.includes(v)) cycles.push(component.reverse());
    }
  };

  for (const v of deps.keys()) if (!index.has(v)) visit(v);
  return cycles;
}

/** For each id, every id it transitively runs after. Assumes the graph has no cycles. */
function ancestorSets(deps: Map<string, string[]>): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const get = (id: string): Set<string> => {
    let set = memo.get(id);
    if (set) return set;
    set = new Set();
    for (const d of deps.get(id)!) {
      set.add(d);
      for (const a of get(d)) set.add(a);
    }
    memo.set(id, set);
    return set;
  };
  for (const id of deps.keys()) get(id);
  return memo;
}
