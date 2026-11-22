import { useEffect, useReducer, useRef } from "react";

const STEP_MIN_MILLIS = 150;
const STEP_MAX_MILLIS = 1_200;
const SLIDE_MAX_MILLIS = 420;
const RELOAD_GUESS_MILLIS = 2_500;

export interface Dripped<Row> {
  rows: Row[];
  /** Newly displayed row keys for the highlight animation. */
  fresh: ReadonlySet<string>;
  glide: number;
}

export function still(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function stepFor(pace: number): number {
  return Math.min(STEP_MAX_MILLIS, Math.max(STEP_MIN_MILLIS, 1 / pace));
}

/** Reveal new rows at the estimated arrival rate. */
export function useDrip<Row>(rows: Row[], key: (row: Row) => string, enabled: boolean, show = rows.length): Dripped<Row> {
  const [, render] = useReducer((count: number) => count + 1, 0);
  const shown = useRef<Row[]>(rows.slice(0, show));
  const fresh = useRef<Set<string>>(new Set());
  const pending = useRef<Row[]>([]);
  const glide = useRef(0);
  const reloadedAt = useRef(0);
  const interval = useRef(RELOAD_GUESS_MILLIS);
  /** Rows per millisecond in the previous refresh. */
  const pace = useRef(0);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trim = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keyOf = useRef(key);
  keyOf.current = key;
  const limit = useRef(Math.min(show, rows.length));

  useEffect(() => {
    const id = keyOf.current;
    limit.current = Math.max(limit.current, Math.min(show, rows.length));
    const now = performance.now();
    if (reloadedAt.current) {
      interval.current = Math.min(10_000, Math.max(500, interval.current * 0.7 + (now - reloadedAt.current) * 0.3));
    }
    reloadedAt.current = now;
    if (!enabled || still() || document.hidden || shown.current.length === 0) {
      clearTimeout(release.current);
      release.current = undefined;
      pending.current = [];
      glide.current = 0;
      shown.current = rows.slice(0, limit.current);
      render();
      return;
    }
    const latest = new Map(rows.map((row) => [id(row), row]));
    const known = new Set([...shown.current, ...pending.current].map(id));
    const incoming = rows.filter((row) => !known.has(id(row))).reverse();
    pace.current = incoming.length / interval.current;
    const step = stepFor(pace.current);
    const perStep = Math.max(1, Math.round(pace.current * step));
    // Skip rows that would scroll out before the next refresh.
    const room = perStep * Math.max(1, Math.floor(interval.current / step));
    pending.current = [...pending.current, ...incoming].slice(-room);
    // Apply updates to rows already on screen.
    shown.current = shown.current.map((row) => latest.get(id(row)) ?? row);
    glide.current = 0;
    render();

    const next = () => {
      release.current = undefined;
      const step = stepFor(pace.current);
      const group = pending.current.splice(0, Math.max(1, Math.round(pace.current * step)));
      if (group.length === 0) return;
      const duration = Math.min(SLIDE_MAX_MILLIS, step * 0.85);
      const entering = group.slice(-limit.current).reverse();
      shown.current = [...entering, ...shown.current.slice(0, limit.current)];
      // Highlight individual arrivals without repainting a batch.
      if (entering.length === 1) fresh.current = new Set([...entering.map(id), ...[...fresh.current].slice(0, limit.current * 2)]);
      glide.current = duration;
      clearTimeout(trim.current);
      trim.current = setTimeout(() => {
        shown.current = shown.current.slice(0, limit.current);
        glide.current = 0;
        render();
      }, Math.max(0, duration - 40));
      render();
      if (pending.current.length) release.current = setTimeout(next, step);
    };
    if (release.current === undefined && pending.current.length) next();
  }, [rows, enabled, show]);

  useEffect(
    () => () => {
      clearTimeout(release.current);
      clearTimeout(trim.current);
    },
    [],
  );

  return { rows: shown.current, fresh: fresh.current, glide: glide.current };
}
