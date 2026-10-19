import { redirect } from "next/navigation";
import { CoupleShell } from "../../components/shell";
import { serverApi } from "../../lib/server-api";
import type { SessionState } from "../../lib/types";

export default async function CoupleLayout({ children }: { children: React.ReactNode }) {
  const session = await serverApi<SessionState>("/auth/me");
  if (session.status === 503) {
    return <main className="main"><p>A API não está disponível. Suba o Compose e tente de novo.</p></main>;
  }
  if (!session.data?.authenticated) redirect("/acesso");
  if (session.data.role !== "COUPLE") redirect("/admin");
  return <CoupleShell email={session.data.email ?? ""}>{children}</CoupleShell>;
}
