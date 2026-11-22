import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { ApiError } from "../api.ts";
import { Link } from "../router.tsx";
import { Icon, type IconName } from "./icons.tsx";

const WIDE_VALUE = 44;
const LONG_VALUE = 18;

export function Title({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const list = useRef<HTMLDListElement>(null);
  const [wide, setWide] = useState<string[]>([]);
  useLayoutEffect(() => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>(".kv__item") ?? [])];
    const measured = items
      .filter((item) => {
        const detail = item.querySelector("dd");
        return (detail?.textContent ?? "").length > WIDE_VALUE || detail?.querySelector(".stages") != null;
      })
      .map((item) => item.dataset.fact ?? "");
    if (measured.length !== wide.length || measured.some((label, index) => label !== wide[index])) {
      setWide(measured);
    }
  });
  return (
    <dl className="kv" ref={list}>
      {rows.map(([label, value]) => (
        <div key={label} className={wide.includes(label) ? "kv__item kv__item--wide" : "kv__item"} data-fact={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Metric({ label, value, note, icon }: { label: string; value: ReactNode; note?: ReactNode; icon?: IconName }) {
  const long = typeof value === "string" && value.length > LONG_VALUE;
  return (
    <article className="card">
      <div className="label">
        {icon && (
          <span className="card__icon">
            <Icon name={icon} />
          </span>
        )}
        <span>{label}</span>
      </div>
      <div className={long ? "value value--long" : "value"}>
        <strong>{value}</strong>
        {note !== undefined && <small>{note}</small>}
      </div>
    </article>
  );
}

export function pageOf(query: URLSearchParams): number {
  const page = Number(query.get("page") ?? "1");
  return Number.isInteger(page) && page >= 1 && page <= 10 ? page : 1;
}

export function Pager({ path, page, older }: { path: string; page: number; older: boolean }) {
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 && (
        <Link className="page-button" to={path}>
          Newest
        </Link>
      )}
      {older && (
        <Link className="page-button" to={`${path}?page=${page + 1}`}>
          Older
        </Link>
      )}
    </nav>
  );
}

export function Pending({ error }: { error?: ApiError | undefined }) {
  if (error === undefined) {
    return <p className="notice">Loading…</p>;
  }
  if (error.status === 404) {
    return <p className="notice">Not found on this chain.</p>;
  }
  return <p className="notice error">{capitalize(error.message)}.</p>;
}

export function MoreButton({ more, loading, error, load }: { more: boolean; loading: boolean; error?: ApiError | undefined; load: () => void }) {
  if (!more) {
    return null;
  }
  return (
    <div className="pager">
      <button type="button" className="page-button" disabled={loading} onClick={load}>
        {loading ? "Loading…" : "Load more"}
      </button>
      {error && <p className="form-message error">{capitalize(error.message)}.</p>}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
