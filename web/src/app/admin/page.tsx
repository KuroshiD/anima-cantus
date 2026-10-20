import { AdminDashboard } from "../../components/admin-dashboard";
import { serverApi } from "../../lib/server-api";
import type { AdminCoupleRow } from "../../lib/types";

export default async function AdminPage() {
  const result = await serverApi<AdminCoupleRow[]>("/admin/painel");
  return <AdminDashboard couples={result.data ?? []} loadError={result.status >= 400 ? "Não foi possível carregar o painel administrativo." : ""} />;
}
