export const KNOWN_TYPES = [
  "MILL",
  "TURN",
  "DRILL",
  "DEBURR",
  "PAINT",
  "ANODIZE",
  "CMM_INSPECT",
  "VISUAL_INSPECT",
  "PACK",
] as const;

export type KnownOperationType = (typeof KNOWN_TYPES)[number];

export interface Operation {
  id: string;
  // Unrecognized types are allowed in input; they produce a warning.
  type: KnownOperationType | (string & {});
  after: string[];
}

export interface Routing {
  routing_id: string;
  part: string;
  customer: string;
  operations?: Operation[];
}

// --- Rules: generic kinds, configured by data -------------------------------

/** Every op of a `first` type is before every op of a `then` type. */
export interface OrderBeforeRule {
  id: string;
  kind: "ORDER_BEFORE";
  first: string[];
  then: string[];
}

/** Every `targets` op that could run last among the targets has a `requires` op after it. */
export interface FollowedByRule {
  id: string;
  kind: "FOLLOWED_BY";
  targets: string[];
  requires: string[];
}

/** At least `min` ops of the given types, anywhere in the routing. */
export interface MinCountRule {
  id: string;
  kind: "MIN_COUNT";
  types: string[];
  min: number;
}

/** Exactly one op of `type`, after every other op. */
export interface LastRule {
  id: string;
  kind: "LAST";
  type: string;
}

export type Rule = OrderBeforeRule | FollowedByRule | MinCountRule | LastRule;

// --- Output ------------------------------------------------------------------

export type RuleViolationCode =
  | "ORDER_BEFORE"
  | "FOLLOWED_BY"
  | "MIN_COUNT"
  | "MISSING_LAST"
  | "MULTIPLE_LAST"
  | "NOT_LAST";

export type InputWarningCode =
  | "EMPTY"
  | "DUPLICATE_ID"
  | "INVALID_AFTER"
  | "CYCLE"
  | "UNRECOGNIZED_TYPE";

export type ViolationCode = RuleViolationCode | InputWarningCode;

export type Severity = "error" | "warning";

export interface Violation {
  routing_id: string;
  part: string;
  /** id of the rule that produced it; null for malformed-input warnings */
  rule: string | null;
  code: ViolationCode;
  severity: Severity;
  op_ids: string[];
  message: string;
}
