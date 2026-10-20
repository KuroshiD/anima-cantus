import { cookies } from "next/headers";

export async function serverApi<T>(path: string): Promise<{ status: number; data: T | null }> {
  const base = process.env.INTERNAL_API_URL;
  if (!base) return { status: 503, data: null };
  const jar = await cookies();
  try {
    const cookieHeader = jar.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
    const response = await fetch(`${base}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { status: response.status, data };
  } catch {
    return { status: 503, data: null };
  }
}
