"use client";

import { musicTipWriteSchema } from "@anima/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiSend, readError } from "../lib/client-api";
import type { AdminTipView, AdminTipsResponse } from "../lib/types";

type Draft = { momentId: string; title: string; artist: string; note: string; active: boolean };
const blank: Draft = { momentId: "", title: "", artist: "", note: "", active: true };

export function AdminTips({ data }: { data: AdminTipsResponse }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<AdminTipView | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((editing || creating) && !dialog.current?.open) dialog.current?.showModal();
    if (!editing && !creating && dialog.current?.open) dialog.current.close();
  }, [editing, creating]);

  function openNew() {
    setDraft({ ...blank, momentId: filter });
    setEditing(null);
    setCreating(true);
    setError("");
  }

  function openEdit(tip: AdminTipView) {
    setDraft({
      momentId: tip.momentId ?? "",
      title: tip.title,
      artist: tip.artist ?? "",
      note: tip.note ?? "",
      active: tip.active,
    });
    setEditing(tip);
    setCreating(false);
    setError("");
  }

  function close() {
    setEditing(null);
    setCreating(false);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = musicTipWriteSchema.safeParse({
      momentId: draft.momentId || null,
      title: draft.title,
      artist: draft.artist,
      note: draft.note,
      active: draft.active,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados da dica.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiSend(editing ? `/admin/dicas/${editing.id}` : "/admin/dicas", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      close();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a dica.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(tip: AdminTipView, active: boolean) {
    setError("");
    try {
      const response = await apiSend(`/admin/dicas/${tip.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          momentId: tip.momentId,
          title: tip.title,
          artist: tip.artist ?? "",
          note: tip.note ?? "",
          active,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a dica.");
    }
  }

  const visible = data.tips.filter((tip) => !filter || tip.momentId === filter);

  return (
    <section className="admin__main">
      <header className="page-header">
        <div><p className="eyebrow">Administração</p><h1 className="page-title">Dicas</h1><p className="text-muted management__intro">Sugestões de músicas por momento da cerimônia, exibidas ao casal no repertório.</p></div>
        <button className="btn btn--primary" type="button" onClick={openNew}>Nova dica</button>
      </header>
      <div className="management__toolbar">
        <label className="field"><span className="field__label">Filtrar por momento</span>
          <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">Todos os momentos</option>
            {data.moments.map((moment) => <option value={moment.id} key={moment.id}>{moment.name}</option>)}
          </select>
        </label>
      </div>
      {error && !dialog.current?.open ? <p className="field__error" role="alert">{error}</p> : null}
      {data.moments.map((moment) => {
        if (filter && filter !== moment.id) return null;
        const tips = visible.filter((tip) => tip.momentId === moment.id);
        return (
          <section className="card management__group" key={moment.id}>
            <header className="management__group-head"><h2 className="heading-serif heading-serif--md">{moment.name}</h2><span className="text-muted">{tips.length} {tips.length === 1 ? "dica" : "dicas"}</span></header>
            {tips.length ? tips.map((tip) => (
              <article className={`management__tip ${tip.active ? "" : "is-inactive"}`} key={tip.id}>
                <div><strong>{tip.title}</strong><p className="text-muted">{[tip.artist, tip.note].filter(Boolean).join(" · ") || "Sem observação"}</p></div>
                <span className={`pill ${tip.active ? "pill--done" : "pill--pending"}`}>{tip.active ? "Ativa" : "Inativa"}</span>
                <div className="management__actions">
                  <button className="btn btn--secondary btn--sm" type="button" onClick={() => openEdit(tip)}>Editar</button>
                  <button className="link" type="button" onClick={() => void setActive(tip, !tip.active)}>{tip.active ? "Desativar" : "Ativar"}</button>
                </div>
              </article>
            )) : <p className="text-muted management__empty">Nenhuma dica para este momento.</p>}
          </section>
        );
      })}
      {!filter && data.tips.some((tip) => tip.momentId === null) ? (
        <section className="card management__group">
          <header className="management__group-head"><h2 className="heading-serif heading-serif--md">Todos os momentos</h2></header>
          {data.tips.filter((tip) => tip.momentId === null).map((tip) => (
            <article className={`management__tip ${tip.active ? "" : "is-inactive"}`} key={tip.id}>
              <div><strong>{tip.title}</strong><p className="text-muted">{[tip.artist, tip.note].filter(Boolean).join(" · ") || "Sem observação"}</p></div>
              <span className={`pill ${tip.active ? "pill--done" : "pill--pending"}`}>{tip.active ? "Ativa" : "Inativa"}</span>
              <div className="management__actions">
                <button className="btn btn--secondary btn--sm" type="button" onClick={() => openEdit(tip)}>Editar</button>
                <button className="link" type="button" onClick={() => void setActive(tip, !tip.active)}>{tip.active ? "Desativar" : "Ativar"}</button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {!data.tips.length ? <section className="card"><p className="text-muted">Nenhuma dica cadastrada.</p></section> : null}
      <dialog className="dialog dialog--form" ref={dialog} onClose={close} aria-labelledby="tip-dialog-title">
        <h2 className="heading-serif heading-serif--md" id="tip-dialog-title">{editing ? "Editar dica" : "Nova dica"}</h2>
        <form className="form" onSubmit={(event) => void save(event)}>
          <label className="field"><span className="field__label">Momento da cerimônia</span>
            <select className="input" value={draft.momentId} onChange={(event) => setDraft({ ...draft, momentId: event.target.value })}>
              <option value="">Todos os momentos</option>
              {data.moments.map((moment) => <option value={moment.id} key={moment.id}>{moment.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="field__label">Música</span><input className="input" required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="field"><span className="field__label">Intérprete / compositor (opcional)</span><input className="input" maxLength={160} value={draft.artist} onChange={(event) => setDraft({ ...draft, artist: event.target.value })} /></label>
          <label className="field"><span className="field__label">Observação (opcional)</span><textarea className="input admin__textarea" maxLength={300} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Exibir para os casais</span></label>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <div className="dialog__actions"><button className="btn btn--secondary" type="button" onClick={close} disabled={busy}>Cancelar</button><button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button></div>
        </form>
      </dialog>
    </section>
  );
}
