function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}

export function isIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function repertoireWindow(weddingIso: string): { start: string; end: string } {
  return {
    start: addDaysIso(weddingIso, -35),
    end: addDaysIso(weddingIso, -30),
  };
}

export function anniversaryIso(weddingIso: string): string {
  const [y, m, d] = parts(weddingIso);
  const candidate = `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (isIsoDate(candidate)) return candidate;
  return `${y + 1}-02-28`;
}

export function daysUntil(isoDate: string, today = new Date()): number {
  const [y, m, d] = parts(isoDate);
  const target = Date.UTC(y, m - 1, d);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((target - start) / 86_400_000));
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function todayIso(timeZone = "America/Sao_Paulo", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
