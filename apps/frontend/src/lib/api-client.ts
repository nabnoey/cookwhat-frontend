type ApiEnvelope<T> = { data: T } | { error: { message: string } };

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const result = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !("data" in result)) {
    throw new Error("error" in result ? result.error.message : "The API request failed.");
  }
  return result.data;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokenResponse = await fetch("/api/backend-token", { cache: "no-store" });
  const tokenResult = await tokenResponse.json() as { token?: string; error?: string };
  if (!tokenResponse.ok || !tokenResult.token) {
    throw new Error(tokenResult.error ?? "Sign in to access account data.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${tokenResult.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return readResponse<T>(await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  }));
}

export async function publicApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return readResponse<T>(await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  }));
}
