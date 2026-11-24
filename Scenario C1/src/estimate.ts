export interface Op {
  id: string;
  name: string;
  machine_type: string;
  hours: number;
  after: string[];
}

export interface Routing {
  job_id: string;
  ops: Op[];
}

/** machine_type -> number of machines on the floor. Anodize is never listed. */
export type Machines = Record<string, number>;

const ANODIZE = "anodize";
const ANODIZE_MINUTES = 72 * 60;

// Shop hours (rule 1): Mon-Fri, 06:00-22:00.
const OPEN_MIN = 6 * 60;
const CLOSE_MIN = 22 * 60;
const DAY_MIN = 24 * 60;

// Times are whole minutes since the Unix epoch, read as shop-local wall-clock
// time. Date.UTC is used only so the host machine's time zone never matters.

function parseLocal(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Bad release time "${s}", expected YYYY-MM-DDTHH:mm`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

function formatLocal(t: number): string {
  return new Date(t * 60000).toISOString().slice(0, 16);
}

function isWeekday(t: number): boolean {
  const day = new Date(t * 60000).getUTCDay();
  return day >= 1 && day <= 5;
}

/** The first moment at or after t when the shop is open. */
function nextOpen(t: number): number {
  for (;;) {
    const dayStart = Math.floor(t / DAY_MIN) * DAY_MIN;
    const minuteOfDay = t - dayStart;
    if (isWeekday(t)) {
      if (minuteOfDay < OPEN_MIN) return dayStart + OPEN_MIN;
      if (minuteOfDay < CLOSE_MIN) return t;
    }
    t = dayStart + DAY_MIN + OPEN_MIN;
  }
}

// Anodize vendor cutoff (rule 2): parts arriving Friday 14:00 or later, or on the
// weekend, aren't started until Monday 06:00.
const VENDOR_FRIDAY_CUTOFF_MIN = 14 * 60;
const VENDOR_MONDAY_START_MIN = 6 * 60;

/** When the anodize vendor starts work on a part that arrives at t. */
function vendorStart(t: number): number {
  const dayStart = Math.floor(t / DAY_MIN) * DAY_MIN;
  const day = new Date(t * 60000).getUTCDay(); // 0 Sun .. 6 Sat
  const daysToMonday = day === 5 ? 3 : day === 6 ? 2 : day === 0 ? 1 : 0;
  const pastFridayCutoff = day === 5 && t - dayStart >= VENDOR_FRIDAY_CUTOFF_MIN;
  if (day === 6 || day === 0 || pastFridayCutoff) {
    return dayStart + daysToMonday * DAY_MIN + VENDOR_MONDAY_START_MIN;
  }
  return t;
}

/** Run `minutes` of in-house work starting at `start` (already open). Returns the finish. */
function addShopMinutes(start: number, minutes: number): number {
  let t = start;
  let left = minutes;
  for (;;) {
    const close = Math.floor(t / DAY_MIN) * DAY_MIN + CLOSE_MIN;
    if (left <= close - t) return t + left;
    left -= close - t;
    t = nextOpen(close);
  }
}

/** Rule 6: whole minutes, rounded up. The inner round strips float noise (4 * 1.1 = 4.4000000000000004). */
function scaledMinutes(hours: number, multiplier: number): number {
  return Math.ceil(Math.round(hours * multiplier * 60 * 1e6) / 1e6);
}

/**
 * Tie-breaker randomness that is repeatable: seeded from the routing itself, so
 * the same routing always picks the same op, but different routings vary.
 * FNV-1a hash for the seed, mulberry32 for the sequence.
 */
function seededRandom(routing: Routing): () => number {
  let seed = 0x811c9dc5;
  for (const ch of JSON.stringify(routing)) {
    seed ^= ch.charCodeAt(0);
    seed = Math.imul(seed, 0x01000193);
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Candidate {
  op: Op;
  readyAt: number;
  start: number;
  machineIndex: number; // -1 for anodize (no machine limit)
}

/**
 * Exact finish time of the job, "YYYY-MM-DDTHH:mm" shop-local.
 * In-house op hours are scaled by `multiplier`; anodize is always 72 calendar hours.
 */
export function finishTime(
  routing: Routing,
  machines: Machines,
  release: string,
  multiplier: number,
): string {
  const releaseAt = parseLocal(release);
  const random = seededRandom(routing);
  const finished = new Map<string, number>();
  // For each machine type, when each machine of that type is next free.
  const freeAt = new Map<string, number[]>();
  const machineSlots = (type: string): number[] => {
    let slots = freeAt.get(type);
    if (!slots) {
      slots = new Array(machines[type] ?? 1).fill(releaseAt);
      freeAt.set(type, slots);
    }
    return slots;
  };

  let pending = [...routing.ops];
  let jobEnd = releaseAt;

  // Commit ops one at a time, always the one that can start earliest. Start
  // times never go backwards, so an op committed later can't have jumped the queue.
  while (pending.length > 0) {
    const candidates: Candidate[] = [];
    for (const op of pending) {
      if (!op.after.every((id) => finished.has(id))) continue;
      const readyAt = Math.max(releaseAt, ...op.after.map((id) => finished.get(id)!));
      if (op.machine_type === ANODIZE) {
        candidates.push({ op, readyAt, start: vendorStart(readyAt), machineIndex: -1 });
        continue;
      }
      const slots = machineSlots(op.machine_type);
      let machineIndex = 0;
      for (let i = 1; i < slots.length; i++) if (slots[i] < slots[machineIndex]) machineIndex = i;
      const start = nextOpen(Math.max(readyAt, slots[machineIndex]));
      candidates.push({ op, readyAt, start, machineIndex });
    }
    if (candidates.length === 0) {
      throw new Error("Routing has a dependency loop or an unknown dependency");
    }

    // Earliest start wins; then the op that became ready first (rule 3);
    // then a repeatable random pick among exact ties.
    const best = Math.min(...candidates.map((c) => c.start));
    const atBest = candidates.filter((c) => c.start === best);
    const firstReady = Math.min(...atBest.map((c) => c.readyAt));
    const tied = atBest.filter((c) => c.readyAt === firstReady);
    const pick = tied[Math.floor(random() * tied.length)];

    const end =
      pick.machineIndex === -1
        ? pick.start + ANODIZE_MINUTES
        : addShopMinutes(pick.start, scaledMinutes(pick.op.hours, multiplier));
    if (pick.machineIndex !== -1) machineSlots(pick.op.machine_type)[pick.machineIndex] = end;

    finished.set(pick.op.id, end);
    jobEnd = Math.max(jobEnd, end);
    pending = pending.filter((o) => o !== pick.op);
  }

  return formatLocal(jobEnd);
}
