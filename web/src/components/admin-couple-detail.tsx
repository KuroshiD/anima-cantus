"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiSend, readError } from "../lib/client-api";
import type { AdminCoupleDetailData } from "../lib/types";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function AdminCoupleDetail({ couple }: { couple: AdminCoupleDetailData }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const weddingStep = couple.journey?.steps.find((step) => step.step === "CASAMENTO");
  const snapshot = couple.contract?.snapshots[0];

  async function action(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await apiSend(path, {
        method: "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return false;
      }
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a ação.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 5) {
      setError("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    if (await action(`/admin/contratos/${couple.contract?.id}/recusar`, { reason: reason.trim() })) setReason("");
  }

  return (
    <div className="admin">
      <header className="legal__bar">
        <Link className="legal__brand" href="/admin" aria-label="Anima Cantus"><span>Anima</span><span>Cantus</span></Link>
        <Link className="btn btn--secondary btn--sm" href="/admin">Voltar ao painel</Link>
      </header>
      <main className="admin__main">
        <p className="eyebrow">Acompanhamento da jornada</p>
        <h1 className="page-title">{couple.partnerOne} &amp; {couple.partnerTwo}</h1>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <section className="card admin__detail">
          <h2 className="heading-serif heading-serif--md">Dados do casal</h2>
          <dl className="admin__facts">
            <div><dt>E-mail</dt><dd>{couple.user?.email ?? couple.email ?? "—"}</dd></div>
            <div><dt>Telefone</dt><dd>{couple.phone ?? "—"}</dd></div>
            <div><dt>Casamento</dt><dd>{dateLabel(couple.weddingDate)}{couple.weddingTime ? ` às ${couple.weddingTime}` : ""}</dd></div>
            <div><dt>Local</dt><dd>{couple.venue ?? "—"}</dd></div>
            <div><dt>Contratante</dt><dd>{couple.legalName ?? "—"}</dd></div>
            <div><dt>Documento</dt><dd>{couple.documentId ?? "—"}</dd></div>
            <div><dt>Endereço</dt><dd>{couple.address ?? "—"}</dd></div>
            <div><dt>Formação</dt><dd>{couple.formation ?? "—"}</dd></div>
          </dl>
        </section>
        <section className="card admin__detail">
          <h2 className="heading-serif heading-serif--md">Contrato</h2>
          {!couple.contract ? <p className="text-muted">Nenhum contrato criado.</p> : (
            <>
              <p>Status: <strong>{couple.contract.status}</strong></p>
              {snapshot ? <p>Total atual: <strong>{money(snapshot.totalCents)}</strong></p> : null}
              {couple.contract.uploadError ? <p className="field__error">Erro no envio: {couple.contract.uploadError}</p> : null}
              <ul className="admin__files">
                {couple.contract.files.map((file) => (
                  <li key={file.id}>
                    <span>{file.kind === "ASSINADO" ? "Contrato assinado" : "Contrato gerado"} · {file.sizeBytes.toLocaleString("pt-BR")} bytes</span>
                    <a className="link" href={`/api/admin/contratos/${couple.contract!.id}/arquivos/${file.id}/download`}>Baixar PDF</a>
                  </li>
                ))}
              </ul>
              {couple.contract.status === "AGUARDANDO_VALIDACAO" ? (
                <div className="admin__actions">
                  <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void action(`/admin/contratos/${couple.contract!.id}/validar`)}>
                    {busy ? "Salvando..." : "Validar contrato"}
                  </button>
                  <form className="form" onSubmit={(event) => void reject(event)}>
                    <label className="field__label" htmlFor="reject-reason">Motivo para devolver</label>
                    <textarea className="input admin__textarea" id="reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} />
                    <button className="btn btn--secondary" type="submit" disabled={busy}>Devolver para ajuste</button>
                  </form>
                </div>
              ) : null}
              {couple.contract.validations.map((validation) => (
                <p className="admin__validation" key={`${validation.createdAt}-${validation.admin.email}`}>
                  {validation.accepted ? "Validado" : `Devolvido: ${validation.reason ?? "sem motivo"}`} · {validation.admin.email}
                </p>
              ))}
            </>
          )}
        </section>
        <section className="card admin__detail">
          <h2 className="heading-serif heading-serif--md">Repertório</h2>
          {couple.selections.length ? (
            <ul className="admin__songs">{couple.selections.map((selection) => <li key={selection.id}><strong>{selection.moment.name}</strong><span>{selection.songTitle || "Ainda não escolhida"}</span></li>)}</ul>
          ) : <p className="text-muted">Nenhuma música registrada.</p>}
        </section>
        {weddingStep?.status === "EM_ANDAMENTO" ? (
          <section className="card admin__detail">
            <h2 className="heading-serif heading-serif--md">Pós-casamento</h2>
            <p>Marque a cerimônia como realizada para avançar a jornada para o pós-evento.</p>
            <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void action(`/admin/casais/${couple.id}/casamento`)}>
              Registrar casamento
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
