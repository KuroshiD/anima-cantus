import { AdminTips } from "../../../components/admin-tips";
import { serverApi } from "../../../lib/server-api";
import type { AdminTipsResponse } from "../../../lib/types";

export default async function AdminTipsPage() {
  const result = await serverApi<AdminTipsResponse>("/admin/dicas");
  if (result.status >= 400 || !result.data) {
    return <section className="admin__main"><p className="field__error" role="alert">Não foi possível carregar as dicas.</p></section>;
  }
  return <AdminTips data={result.data} />;
}
