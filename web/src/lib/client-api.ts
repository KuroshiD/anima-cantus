let csrfToken: string | null = null;

export function rememberCsrf(token: string): void {
  csrfToken = token;
}

export function clearCsrf(): void {
  csrfToken = null;
}

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf", { credentials: "include" });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { token: string };
  if (!data.token) throw new Error("Não foi possível iniciar a verificação de segurança.");
  csrfToken = data.token;
  return csrfToken;
}

export async function apiSend(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (method !== "GET" && method !== "HEAD") headers.set("x-csrf-token", await ensureCsrf());
  return fetch(`/api${path}`, { ...init, headers, credentials: "include" });
}

export async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!data?.message) return "Não foi possível concluir a ação.";
  return Array.isArray(data.message) ? data.message.join(" ") : data.message;
}
