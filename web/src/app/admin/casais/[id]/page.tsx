import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminCoupleDetail } from "../../../../components/admin-couple-detail";
import { serverApi } from "../../../../lib/server-api";
import type { AdminCoupleDetailData, SessionState } from "../../../../lib/types";

export default async function AdminCouplePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, serverApi<SessionState>("/auth/me")]);
  if (session.status === 503) return <main className="legal__main"><p role="alert">A API não está disponível. Tente novamente.</p></main>;
  if (!session.data?.authenticated) redirect("/acesso");
  if (session.data.role !== "ADMIN") redirect("/jornada");
  const result = await serverApi<AdminCoupleDetailData>(`/admin/casais/${encodeURIComponent(id)}`);
  if (result.status === 404) notFound();
  if (!result.data || result.status >= 400) {
    return <main className="legal__main"><p role="alert">Não foi possível carregar os dados do casal.</p><Link className="link" href="/admin">Voltar ao painel</Link></main>;
  }
  return <AdminCoupleDetail couple={result.data} />;
}
