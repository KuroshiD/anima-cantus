import { redirect } from "next/navigation";
import { AdminDashboard } from "../../components/admin-dashboard";
import { serverApi } from "../../lib/server-api";
import type { AdminCoupleRow, SessionState } from "../../lib/types";

export default async function AdminPage() {
  const session = await serverApi<SessionState>("/auth/me");
  if (session.status === 503) {
    return <main className="legal__main"><p role="alert">A API não está disponível. Suba o Compose e tente novamente.</p></main>;
  }
  if (!session.data?.authenticated) redirect("/acesso");
  if (session.data.role !== "ADMIN") redirect("/jornada");

  const result = await serverApi<AdminCoupleRow[]>("/admin/painel");
  if (result.status === 401 || result.status === 403) redirect("/acesso");
  return <AdminDashboard couples={result.data ?? []} loadError={result.status >= 400 ? "Não foi possível carregar o painel administrativo." : ""} />;
}
