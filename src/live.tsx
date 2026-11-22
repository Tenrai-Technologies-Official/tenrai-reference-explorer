import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Live {
  connected: boolean;
  height?: number;
  /** Bounded refresh signal for pages using `useApi`. */
  tick: number;
}

const FALLBACK_MILLIS = 15_000;
const REFRESH_MILLIS = 1_000;

const LiveContext = createContext<Live>({ connected: false, tick: 0 });

export function LiveProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<Live>({ connected: false, tick: 0 });

  useEffect(() => {
    let lastCut = Date.now();
    let latestHeight: number | undefined;
    let refreshedAt = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let missed = false;
    const refresh = () => {
      refreshTimer = undefined;
      refreshedAt = Date.now();
      setLive((last) => ({ ...last, height: latestHeight ?? last.height, tick: last.tick + 1 }));
    };
    const scheduleRefresh = () => {
      // Coalesce background updates into one refresh on return.
      if (document.hidden) {
        missed = true;
        return;
      }
      const delay = Math.max(0, REFRESH_MILLIS - (Date.now() - refreshedAt));
      if (delay === 0) {
        refresh();
      } else if (refreshTimer === undefined) {
        refreshTimer = setTimeout(refresh, delay);
      }
    };
    const source = new EventSource("/api/live");
    source.onopen = () => setLive((last) => ({ ...last, connected: true }));
    source.onerror = () => setLive((last) => ({ ...last, connected: false }));
    source.addEventListener("cut", (event) => {
      const { height } = JSON.parse(event.data) as { height: number };
      lastCut = Date.now();
      latestHeight = height;
      setLive((last) => (last.connected ? last : { ...last, connected: true }));
      scheduleRefresh();
    });
    // Keep a polling fallback if the stream is idle.
    const fallback = setInterval(() => {
      if (Date.now() - lastCut >= FALLBACK_MILLIS) {
        scheduleRefresh();
      }
    }, FALLBACK_MILLIS);
    const onVisibility = () => {
      if (!document.hidden && missed) {
        missed = false;
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      source.close();
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimer !== undefined) {
        clearTimeout(refreshTimer);
      }
    };
  }, []);

  return <LiveContext value={live}>{children}</LiveContext>;
}

export function useLive(): Live {
  return useContext(LiveContext);
}
