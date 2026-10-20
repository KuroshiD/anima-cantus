import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin-shell";
import { serverApi } from "../../lib/server-api";
import type { SessionState } from "../../lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await serverApi<SessionState>("/auth/me");
  if (session.status === 503) {
    return <main className="legal__main"><p role="alert">A API não está disponível. Suba o Compose e tente novamente.</p></main>;
  }
  if (!session.data?.authenticated) redirect("/acesso");
  if (session.data.role !== "ADMIN") redirect("/jornada");
  return <AdminShell email={session.data.email ?? ""}>{children}</AdminShell>;
}
