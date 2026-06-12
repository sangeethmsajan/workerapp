import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Global "view-as" user override for super admins. Read by getQueryFn + apiRequest.
let viewingAsUserId: number | null = null;
const subs = new Set<(v: number | null) => void>();
export function getViewingAsUserId(): number | null { return viewingAsUserId; }
export function setViewingAsUserId(id: number | null) {
  viewingAsUserId = id;
  subs.forEach((fn) => fn(id));
}
export function subscribeViewingAs(fn: (v: number | null) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

function appendUserIdParam(url: string): string {
  if (viewingAsUserId == null) return url;
  // Only API GETs benefit; we attach blindly — backend ignores when not super_admin.
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}userId=${viewingAsUserId}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // For GETs (and any read) attach the view-as param when active.
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  const finalUrl = isWrite ? appendUserIdParam(url) : appendUserIdParam(url);
  const res = await fetch(`${API_BASE}${finalUrl}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/");
    const url = appendUserIdParam(path);
    const res = await fetch(`${API_BASE}${url}`, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
