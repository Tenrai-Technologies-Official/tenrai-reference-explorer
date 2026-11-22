import { useEffect, useState } from "react";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly reason: string | undefined;

  constructor(status: number, code: string, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.reason = reason;
  }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { accept: "application/json" } });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, "unavailable", "the explorer is not reachable");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, message, reason } = (body ?? {}) as { code?: string; message?: string; reason?: string };
    throw new ApiError(response.status, code ?? "internal", message ?? `HTTP ${response.status}`, reason);
  }
  return body as T;
}

export interface Loaded<T> {
  data?: T;
  error?: ApiError;
}

/** Retain the current response while fetching a refresh. */
export function useApi<T>(path: string, refresh?: unknown): Loaded<T> {
  const [state, setState] = useState<Loaded<T> & { path?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    getJson<T>(path, controller.signal).then(
      (data) => setState({ path, data }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState((last) => ({ path, data: last.path === path ? last.data : undefined, error: asApiError(error) }));
        }
      },
    );
    return () => controller.abort();
  }, [path, refresh]);
  return state.path === path ? state : {};
}

/** Fetch later pages from the preceding page's cursor. */
export function useMore<Page>(first: Page | undefined, cursorOf: (page: Page) => string | null, url: (cursor: string) => string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError>();
  const last = pages.at(-1) ?? first;
  const cursor = last === undefined ? null : cursorOf(last);

  const load = async () => {
    if (!cursor) {
      return;
    }
    setLoading(true);
    try {
      const page = await getJson<Page>(url(cursor));
      setPages((loaded) => [...loaded, page]);
      setError(undefined);
    } catch (failure) {
      setError(asApiError(failure));
    } finally {
      setLoading(false);
    }
  };

  return { pages, more: cursor !== null, loading, error, load };
}

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, "internal", String(error));
}
