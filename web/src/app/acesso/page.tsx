import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessForm } from "../../components/access-form";
import { serverApi } from "../../lib/server-api";
import type { SessionState } from "../../lib/types";

export const metadata: Metadata = {
  title: "Entrar — Anima Cantus",
};

export default async function AccessPage() {
  const [session, dateConfig] = await Promise.all([
    serverApi<SessionState>("/auth/me"),
    serverApi<{ maxWeddingAdvanceDays: number }>("/configuracao/datas"),
  ]);
  if (session.data?.authenticated) {
    redirect(session.data.role === "ADMIN" ? "/admin" : "/jornada");
  }
  return <AccessForm maxWeddingAdvanceDays={dateConfig.data?.maxWeddingAdvanceDays ?? 120} />;
}
