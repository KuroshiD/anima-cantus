import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminCoupleDetail } from "../../../../components/admin-couple-detail";
import { serverApi } from "../../../../lib/server-api";
import type { AdminCoupleDetailData } from "../../../../lib/types";

export default async function AdminCouplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await serverApi<AdminCoupleDetailData>(`/admin/casais/${encodeURIComponent(id)}`);
  if (result.status === 404) notFound();
  if (!result.data || result.status >= 400) {
    return <section className="admin__main"><p role="alert">Não foi possível carregar os dados do casal.</p><Link className="link" href="/admin">Voltar ao painel</Link></section>;
  }
  return <AdminCoupleDetail couple={result.data} />;
}
