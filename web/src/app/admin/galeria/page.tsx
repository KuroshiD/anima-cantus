import { AdminGallery } from "../../../components/admin-gallery";
import { serverApi } from "../../../lib/server-api";
import type { AdminGalleryView } from "../../../lib/types";

export default async function AdminGalleryPage() {
  const result = await serverApi<AdminGalleryView[]>("/admin/galeria");
  if (result.status >= 400 || !result.data) {
    return <section className="admin__main"><p className="field__error" role="alert">Não foi possível carregar a galeria.</p></section>;
  }
  return <AdminGallery items={result.data} />;
}
