"use client";

import { contentWriteSchema } from "@anima/shared";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiSend, readError } from "../lib/client-api";

const labels: Record<string, { label: string; hint: string }> = {
  hero_title: { label: "Título inicial", hint: "Destaque do topo do site" },
  hero_text: { label: "Apresentação", hint: "Texto de apresentação" },
  about: { label: "Sobre o grupo", hint: "Quem somos" },
  instagram_url: { label: "Instagram", hint: "Endereço do perfil" },
};

export function AdminContent({ pages }: { pages: Record<string, string> }) {
  const router = useRouter();
  const keys = useMemo(() => Object.keys(pages).sort((a, b) => (labels[a]?.label ?? a).localeCompare(labels[b]?.label ?? b, "pt-BR")), [pages]);
  const [activeKey, setActiveKey] = useState(keys[0] ?? "");
  const [value, setValue] = useState(pages[activeKey] ?? "");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = value !== (pages[activeKey] ?? "");

  function selectKey(key: string) {
    if (dirty && !window.confirm("Descartar as alterações não salvas?")) return;
    setError("");
    setMessage("");
    setActiveKey(key);
    setValue(pages[key] ?? "");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = contentWriteSchema.safeParse({ value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe o conteúdo.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiSend(`/admin/conteudo/${encodeURIComponent(activeKey)}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setMessage("Conteúdo salvo.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o conteúdo.");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const key = newKey.trim();
    if (!/^[a-z0-9_-]{2,80}$/.test(key)) {
      setError("Use uma chave de 2 a 80 caracteres: letras minúsculas, números, hífen ou sublinhado.");
      return;
    }
    if (key in pages) {
      setError("Já existe um bloco com essa chave.");
      return;
    }
    const parsed = contentWriteSchema.safeParse({ value: newValue });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe o conteúdo inicial.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiSend(`/admin/conteudo/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setActiveKey(key);
      setValue(newValue.trim());
      setCreating(false);
      setNewKey("");
      setNewValue("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o bloco.");
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    setValue(pages[activeKey] ?? "");
    setMessage("");
    setError("");
  }

  return (
    <section className="admin__main">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Conteúdo</h1>
          <p className="text-muted management__intro">Edite os valores de conteúdo salvos pela API. Cada bloco usa sua chave.</p>
        </div>
        <button className="btn btn--secondary" type="button" onClick={() => { setCreating(!creating); setError(""); }}>Novo bloco</button>
      </header>
      {error ? <p className="field__error management__error" role="alert">{error}</p> : null}
      {creating ? (
        <form className="card management__form" onSubmit={(event) => void create(event)}>
          <h2 className="heading-serif heading-serif--md">Adicionar bloco</h2>
          <label className="field"><span className="field__label">Chave (slug)</span><input className="input" required value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="como-funciona" /></label>
          <label className="field"><span className="field__label">Valor inicial</span><textarea className="input admin__textarea" required maxLength={5000} value={newValue} onChange={(event) => setNewValue(event.target.value)} /></label>
          <div className="dialog__actions">
            <button className="btn btn--secondary" type="button" onClick={() => setCreating(false)} disabled={busy}>Cancelar</button>
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Criar bloco"}</button>
          </div>
        </form>
      ) : null}
      {keys.length === 0 && !activeKey ? (
        <section className="card"><p className="text-muted">Ainda não há blocos de conteúdo cadastrados. Crie o primeiro para começar.</p></section>
      ) : (
        <div className="content-grid">
          <nav className="card blocks" aria-label="Blocos de conteúdo">
            {keys.map((key) => (
              <button key={key} type="button" aria-current={key === activeKey ? "true" : undefined} onClick={() => selectKey(key)}>
                {labels[key]?.label ?? key}<small>{labels[key]?.hint ?? "Conteúdo do site"}</small>
              </button>
            ))}
          </nav>
          <form className="card form-card" onSubmit={(event) => void save(event)}>
            <header className="form-card__head">
              <h2 className="heading-serif heading-serif--md">{labels[activeKey]?.label ?? activeKey}</h2>
              <p className="management__key">Chave: <code>{activeKey}</code></p>
            </header>
            <label className="field">
              <span className="field__label">Valor</span>
              <textarea className="input admin__textarea management__content-input" required maxLength={5000} value={value} onChange={(event) => { setValue(event.target.value); setMessage(""); }} />
              <span className="field__hint">{value.length}/5000 caracteres</span>
            </label>
            {error ? <p className="field__error" role="alert">{error}</p> : null}
            <div className="savebar">
              <span className={`savebar__status ${dirty ? "is-dirty" : ""}`} role="status">{message || (dirty ? "Alterações não salvas" : "Sem alterações")}</span>
              <button className="btn btn--secondary" type="button" onClick={discard} disabled={!dirty || busy}>Descartar alterações</button>
              <button className="btn btn--primary" type="submit" disabled={!dirty || busy}>{busy ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
