"use client";

import { galleryWriteSchema } from "@anima/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiSend, readError } from "../lib/client-api";
import type { AdminGalleryView } from "../lib/types";

type Draft = { title: string; mediaUrl: string; kind: "foto" | "video"; altText: string; sortOrder: string; active: boolean };
const blank: Draft = { title: "", mediaUrl: "", kind: "foto", altText: "", sortOrder: "0", active: true };

export function AdminGallery({ items }: { items: AdminGalleryView[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<AdminGalleryView | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((editing || creating) && !dialog.current?.open) dialog.current?.showModal();
    if (!editing && !creating && dialog.current?.open) dialog.current.close();
  }, [editing, creating]);

  function openNew() {
    setDraft({ ...blank, sortOrder: String(items.length + 1) });
    setEditing(null);
    setCreating(true);
    setError("");
  }

  function openEdit(item: AdminGalleryView) {
    setDraft({
      title: item.title,
      mediaUrl: item.mediaUrl,
      kind: item.kind === "video" ? "video" : "foto",
      altText: item.altText,
      sortOrder: String(item.sortOrder),
      active: item.active,
    });
    setEditing(item);
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
    const parsed = galleryWriteSchema.safeParse({
      ...draft,
      sortOrder: Number(draft.sortOrder),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados da galeria.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiSend(editing ? `/admin/galeria/${editing.id}` : "/admin/galeria", {
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
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o item.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(item: AdminGalleryView, active: boolean) {
    setError("");
    try {
      const response = await apiSend(`/admin/galeria/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...item, active }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o item.");
    }
  }

  return (
    <section className="admin__main">
      <header className="page-header">
        <div><p className="eyebrow">Administração</p><h1 className="page-title">Galeria</h1><p className="text-muted management__intro">Gerencie as mídias do site. A ordem definida aqui controla a exibição.</p></div>
        <button className="btn btn--primary" type="button" onClick={openNew}>Novo item</button>
      </header>
      <p className="alert management__notice">A API recebe a URL da mídia; hospede o arquivo e informe o endereço. Itens podem ser desativados, mas não excluídos.</p>
      {error && !dialog.current?.open ? <p className="field__error" role="alert">{error}</p> : null}
      <div className="management__gallery">
        {items.map((item) => (
          <article className="card management__gallery-card" key={item.id}>
            {item.kind === "foto" ? <img className="management__gallery-image" src={item.mediaUrl} alt={item.altText} /> : <div className="management__gallery-video">Vídeo</div>}
            <div className="management__gallery-body">
              <div className="management__gallery-heading"><strong>{item.title}</strong><span className={`pill ${item.active ? "pill--done" : "pill--pending"}`}>{item.active ? "Publicado" : "Inativo"}</span></div>
              <p className="text-muted">{item.kind === "video" ? "Vídeo" : "Foto"} · Ordem {item.sortOrder}</p>
              <p className="management__url">{item.mediaUrl}</p>
            </div>
            <div className="management__actions">
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => openEdit(item)}>Editar</button>
              <button className="link" type="button" onClick={() => void setActive(item, !item.active)}>{item.active ? "Desativar" : "Publicar"}</button>
            </div>
          </article>
        ))}
        {!items.length ? <p className="card text-muted">Nenhum item na galeria. Adicione o primeiro.</p> : null}
      </div>
      <dialog className="dialog dialog--form" ref={dialog} onClose={close} aria-labelledby="gallery-dialog-title">
        <h2 className="heading-serif heading-serif--md" id="gallery-dialog-title">{editing ? "Editar item" : "Novo item"}</h2>
        <form className="form" onSubmit={(event) => void save(event)}>
          <label className="field"><span className="field__label">Título</span><input className="input" required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="field"><span className="field__label">URL da mídia</span><input className="input" required maxLength={400} value={draft.mediaUrl} onChange={(event) => setDraft({ ...draft, mediaUrl: event.target.value })} placeholder="https://... ou /gallery/..." /></label>
          <label className="field"><span className="field__label">Tipo de mídia</span><select className="input" value={draft.kind} onChange={(event) => {
            const kind = event.target.value;
            if (kind === "foto" || kind === "video") setDraft({ ...draft, kind });
          }}><option value="foto">Foto</option><option value="video">Vídeo</option></select></label>
          <label className="field"><span className="field__label">Texto alternativo</span><input className="input" required minLength={3} maxLength={200} value={draft.altText} onChange={(event) => setDraft({ ...draft, altText: event.target.value })} /></label>
          <label className="field"><span className="field__label">Ordem de exibição</span><input className="input" type="number" step="1" required value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Publicado no site</span></label>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <div className="dialog__actions"><button className="btn btn--secondary" type="button" onClick={close} disabled={busy}>Cancelar</button><button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button></div>
        </form>
      </dialog>
    </section>
  );
}
