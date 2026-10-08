import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiFetch, apiFetchRaw } from "./api";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 403) {
      try {
        const body = await res.clone().json();
        if (body.redirectTo) {
          window.location.href = body.redirectTo;
          throw new Error("Email verification required");
        }
      } catch (e: any) {
        if (e.message === "Email verification required") throw e;
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await apiFetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
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
    const url = queryKey[0] as string;

    // Callers that opt into `returnNull` handle 401 themselves; everyone else
    // goes through apiFetch, which signs the user out on 401.
    const res =
      unauthorizedBehavior === "returnNull"
        ? await apiFetchRaw(url)
        : await apiFetch(url);

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
