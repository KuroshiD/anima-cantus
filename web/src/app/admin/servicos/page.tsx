import { AdminServices } from "../../../components/admin-services";
import { serverApi } from "../../../lib/server-api";
import type { ServiceItemView } from "../../../lib/types";

export default async function AdminServicesPage() {
  const result = await serverApi<ServiceItemView[]>("/admin/servicos");
  if (result.status >= 400 || !result.data) {
    return <section className="admin__main"><p className="field__error" role="alert">Não foi possível carregar os serviços.</p></section>;
  }
  return <AdminServices services={result.data} />;
}
