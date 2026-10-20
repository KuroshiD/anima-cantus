"use client";

import { alertConfigSchema } from "@anima/shared";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiSend, readError } from "../lib/client-api";

export function AdminAlertSettings({ reminderLeadDays }: { reminderLeadDays: number }) {
  const router = useRouter();
  const [savedValue, setSavedValue] = useState(reminderLeadDays);
  const [value, setValue] = useState(String(reminderLeadDays));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = value !== String(savedValue);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = alertConfigSchema.safeParse({ reminderLeadDays: Number(value) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe um prazo entre 0 e 60 dias.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiSend("/admin/alertas", {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setSavedValue(parsed.data.reminderLeadDays);
      setValue(String(parsed.data.reminderLeadDays));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a configuração.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin__main">
      <header className="page-header">
        <div><p className="eyebrow">Administração</p><h1 className="page-title">Alertas</h1><p className="text-muted management__intro">Configure quando começa o lembrete de prazo do repertório.</p></div>
      </header>
      <form className="card management__form" onSubmit={(event) => void save(event)}>
        <div className="management__alert-heading">
          <div><h2 className="heading-serif heading-serif--md">Prazo do repertório</h2><p className="text-muted">O casal recebe um aviso quando ainda faltam músicas e a data final recomendada está próxima.</p></div>
        </div>
        <label className="field management__alert-field">
          <span className="field__label">Avisar a partir de quantos dias antes do fim da janela</span>
          <input className="input" type="number" min={0} max={60} step={1} required value={value} onChange={(event) => setValue(event.target.value)} />
          <span className="field__hint">De 0 a 60 dias. O mesmo valor é usado nos alertas do casal, lembretes por e-mail e sinalização do painel.</span>
        </label>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <div className="savebar">
          <span className={`savebar__status ${dirty ? "is-dirty" : ""}`} role="status">{dirty ? "Alterações não salvas" : "Sem alterações"}</span>
          <button className="btn btn--secondary" type="button" disabled={!dirty || busy} onClick={() => { setValue(String(savedValue)); setError(""); }}>Descartar alterações</button>
          <button className="btn btn--primary" type="submit" disabled={!dirty || busy}>{busy ? "Salvando..." : "Salvar configuração"}</button>
        </div>
      </form>
    </section>
  );
}
