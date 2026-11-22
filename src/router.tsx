import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

interface Place {
  path: string;
  query: URLSearchParams;
}

const PlaceContext = createContext<Place>(current());

export function Router({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState(current);
  useEffect(() => {
    const update = () => setPlace(current());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return <PlaceContext value={place}>{children}</PlaceContext>;
}

export function usePlace(): Place {
  return useContext(PlaceContext);
}

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}): void {
  if (replace) {
    window.history.replaceState(null, "", to);
  } else {
    window.history.pushState(null, "", to);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

/** Preserve the browser's modified-click and middle-click behavior. */
export function Link({ to, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return <a {...props} href={to} onClick={follow} />;
}

function current(): Place {
  return { path: window.location.pathname, query: new URLSearchParams(window.location.search) };
}
