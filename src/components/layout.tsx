import { type FormEvent, useEffect, useState } from "react";
import type { SearchResult, Status } from "../../shared/api.ts";
import { ApiError, getJson, useApi } from "../api.ts";
import { count } from "../format.ts";
import { useLive } from "../live.tsx";
import { Link, navigate, usePlace } from "../router.tsx";
import { Icon } from "./icons.tsx";
import { ThemeToggle } from "./theme.tsx";

// Show the sync warning only after the lag persists.
const SYNC_SHOWN_AFTER_MILLIS = 5_000;

const TABS: [string, string][] = [
  ["/", "Overview"],
  ["/cuts", "Cuts"],
  ["/blocks", "Blocks"],
  ["/transactions", "Transactions"],
  ["/mempool", "Mempool"],
  ["/validators", "Validators"],
];

function useBehind(sync: Status["sync"]): Status["sync"] {
  const [since, setSince] = useState<number | null>(null);
  const [, setNow] = useState(0);
  const behind = sync !== null && !sync.synced;
  useEffect(() => {
    if (!behind) {
      setSince(null);
      return;
    }
    setSince((value) => value ?? Date.now());
    const timer = setTimeout(() => setNow(Date.now()), SYNC_SHOWN_AFTER_MILLIS);
    return () => clearTimeout(timer);
  }, [behind]);
  return behind && since !== null && Date.now() - since >= SYNC_SHOWN_AFTER_MILLIS ? sync : null;
}

export function Header() {
  const { path } = usePlace();
  const live = useLive();
  const { data: status } = useApi<Status>("/api/status", live.tick);
  const height = live.height ?? status?.height;
  const behind = useBehind(status?.sync ?? null);
  useEffect(() => {
    document.body.dataset.route = path === "/" ? "home" : "page";
  }, [path]);
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const typing = event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]") !== null;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || typing) {
        return;
      }
      const field = [...document.querySelectorAll<HTMLInputElement>(".search input")].find(
        (input) => input.offsetParent !== null && getComputedStyle(input).visibility !== "hidden",
      );
      if (field) {
        event.preventDefault();
        field.focus();
      }
    };
    document.addEventListener("keydown", focus);
    return () => document.removeEventListener("keydown", focus);
  }, []);

  return (
    <header className="appbar">
      <div className="appbar__in wrap">
        <Link className="brand" to="/" aria-label="Explorer home">
          <img className="brand__logo" src="/tenrai-logo-white.png" alt="Tenrai" width="960" height="224" />
          <span className="brand__name">Explorer</span>
        </Link>
        <Search />
        <div className="status" aria-live="polite">
          {status && <span className="pill">{status.network}</span>}
          {height !== undefined && <span className="pill">Cut {count(height)}</span>}
          {behind && <span className="pill bad">{behind.peers === 0 ? "No peers" : `Behind by ${count(behind.behindBy)} cuts`}</span>}
          <span className={live.connected ? "pill live" : "pill"}>{live.connected ? "Live" : "Connecting…"}</span>
        </div>
        <ThemeToggle />
      </div>
      <nav className="tabs" aria-label="Sections">
        <div className="tabs__in wrap">
          {TABS.map(([to, label]) => (
            <Link key={to} to={to} className={isActive(path, to) ? "active" : undefined}>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

export function Search({ hero = false }: { hero?: boolean }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const wanted = query.trim();
    if (!wanted) {
      return;
    }
    setBusy(true);
    try {
      const { path } = await getJson<SearchResult>(`/api/search?q=${encodeURIComponent(wanted)}`);
      setQuery("");
      setMessage("");
      navigate(path);
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 404 ? "Nothing on this chain matches." : "The search failed; try again.");
    } finally {
      setBusy(false);
    }
  };

  const id = hero ? "hero-search" : "search";
  return (
    <div className={hero ? "search search--hero" : "search"} role="search">
      <form onSubmit={submit} noValidate>
        <label className="visually-hidden" htmlFor={id}>
          Cut height, block, transaction or address
        </label>
        <Icon name="search" className="search__icon" />
        <input
          id={id}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cut height, ID or address"
          autoComplete="off"
          spellCheck={false}
          maxLength={128}
        />
        {!hero && (
          <kbd className="search__key" aria-hidden="true">
            /
          </kbd>
        )}
        <button type="submit" disabled={busy}>
          <span className="visually-hidden">Search</span>
          <Icon name="arrow" />
        </button>
      </form>
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="site-foot">
      <div className="wrap site-foot__in">
        <img className="site-foot__logo" src="/tenrai-logo-technologies-white.png" alt="Tenrai Technologies" width="960" height="224" />
        <nav className="site-foot__links" aria-label="Tenrai">
          <a href="https://tenrai-technologies.org/">Website</a>
          <a href="https://wallet.tenrai-technologies.org/">Wallet</a>
          <a href="https://api.tenrai-technologies.org/">API</a>
          <a href="https://docs.tenrai-technologies.org/">Docs</a>
          <a href="https://github.com/tenrai-technologies/">GitHub</a>
        </nav>
        <p className="site-foot__copy">
          © <a href="https://tenrai-technologies.org/">Tenrai Technologies</a>
        </p>
      </div>
    </footer>
  );
}

function isActive(path: string, tab: string): boolean {
  return tab === "/" ? path === "/" : path === tab || path.startsWith(`${tab}/`);
}
