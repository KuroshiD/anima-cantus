import { AdminAlertSettings } from "../../../components/admin-alert-settings";
import { serverApi } from "../../../lib/server-api";

type AlertConfig = { reminderLeadDays: number } | null;

export default async function AdminAlertsPage() {
  const result = await serverApi<AlertConfig>("/admin/alertas");
  if (result.status >= 400) {
    return <section className="admin__main"><p className="field__error" role="alert">Não foi possível carregar a configuração de alertas.</p></section>;
  }
  return <AdminAlertSettings reminderLeadDays={result.data?.reminderLeadDays ?? 7} />;
}
