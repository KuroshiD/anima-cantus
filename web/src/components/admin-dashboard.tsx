"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend, clearCsrf, readError } from "../lib/client-api";
import type { AdminCoupleRow } from "../lib/types";

export function AdminDashboard({ couples, loadError }: { couples: AdminCoupleRow[]; loadError: string }) {
  const router = useRouter();
  const [error, setError] = useState(loadError);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await apiSend("/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      clearCsrf();
      router.replace("/acesso");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sair da conta.");
    } finally {
      setBusy(false);
    }
  }

  const withAlerts = couples.filter((couple) => couple.flags.length > 0).length;
  const pendingContracts = couples.filter((couple) => couple.contractStatus === "AGUARDANDO_VALIDACAO").length;

  return (
    <div className="admin">
      <header className="legal__bar">
        <Link className="legal__brand" href="/admin" aria-label="Anima Cantus"><span>Anima</span><span>Cantus</span></Link>
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => void logout()} disabled={busy}>{busy ? "Saindo..." : "Sair"}</button>
      </header>
      <main className="admin__main">
        <header className="page-header">
          <div><p className="eyebrow">Anima Cantus</p><h1 className="page-title">Painel administrativo</h1></div>
        </header>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <section className="admin__stats" aria-label="Resumo">
          <article className="card admin__stat"><span>Casais acompanhados</span><strong>{couples.length}</strong></article>
          <article className="card admin__stat"><span>Contratos em conferência</span><strong>{pendingContracts}</strong></article>
          <article className="card admin__stat"><span>Casais com alertas</span><strong>{withAlerts}</strong></article>
        </section>
        <section className="card admin__table-card">
          <h2 className="heading-serif heading-serif--md">Jornadas dos casais</h2>
          {couples.length === 0 ? <p className="text-muted">Ainda não há casais cadastrados.</p> : (
            <div className="admin__table-scroll">
              <table className="admin__table">
                <thead><tr><th>Casal</th><th>Casamento</th><th>Contrato</th><th>Repertório</th><th>Acompanhamento</th><th /></tr></thead>
                <tbody>
                  {couples.map((couple) => (
                    <tr key={couple.id}>
                      <td><strong>{couple.name}</strong><span>{couple.email ?? "E-mail não informado"}</span></td>
                      <td>{couple.weddingLabel}</td>
                      <td>{couple.totalLabel}{couple.contractStatus === "AGUARDANDO_VALIDACAO" ? <span className="admin__tag">Em conferência</span> : null}</td>
                      <td>{couple.repertoire}</td>
                      <td>{couple.flags.length ? <span className="admin__tag admin__tag--alert">{couple.flags.length} alerta(s)</span> : "Em dia"}</td>
                      <td><Link className="link" href={`/admin/casais/${couple.id}`}>Abrir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
