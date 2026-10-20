import { AdminContent } from "../../../components/admin-content";
import { serverApi } from "../../../lib/server-api";
import type { PublicContentView } from "../../../lib/types";

export default async function AdminContentPage() {
  const result = await serverApi<PublicContentView>("/conteudo");
  if (result.status >= 400 || !result.data) {
    return <section className="admin__main"><p className="field__error" role="alert">Não foi possível carregar os blocos de conteúdo.</p></section>;
  }
  return <AdminContent pages={result.data.pages} />;
}
