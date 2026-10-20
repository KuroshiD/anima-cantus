import { redirect } from "next/navigation";
import { serverApi } from "../lib/server-api";
import type { SessionState } from "../lib/types";

export default async function HomePage() {
  const session = await serverApi<SessionState>("/auth/me");
  if (session.status === 503) {
    return <main className="legal__main"><p role="alert">A API não está disponível. Tente novamente em instantes.</p></main>;
  }
  if (!session.data?.authenticated) redirect("/acesso");
  redirect(session.data.role === "ADMIN" ? "/admin" : "/jornada");
}
