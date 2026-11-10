"use client";

import { alertConfigSchema } from "@anima/shared";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiSend, readError } from "../lib/client-api";

export function AdminAlertSettings({
  reminderLeadDays,
  maxWeddingAdvanceDays,
}: {
  reminderLeadDays: number;
  maxWeddingAdvanceDays: number;
}) {
  const router = useRouter();
  const [savedReminderLeadDays, setSavedReminderLeadDays] = useState(reminderLeadDays);
  const [reminderValue, setReminderValue] = useState(String(reminderLeadDays));
  const [savedMaxAdvanceDays, setSavedMaxAdvanceDays] = useState(maxWeddingAdvanceDays);
  const [maxAdvanceValue, setMaxAdvanceValue] = useState(String(maxWeddingAdvanceDays));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = reminderValue !== String(savedReminderLeadDays) || maxAdvanceValue !== String(savedMaxAdvanceDays);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = alertConfigSchema.safeParse({
      reminderLeadDays: Number(reminderValue),
      maxWeddingAdvanceDays: Number(maxAdvanceValue),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os prazos informados.");
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
      setSavedReminderLeadDays(parsed.data.reminderLeadDays);
      setReminderValue(String(parsed.data.reminderLeadDays));
      setSavedMaxAdvanceDays(parsed.data.maxWeddingAdvanceDays);
      setMaxAdvanceValue(String(parsed.data.maxWeddingAdvanceDays));
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
          <input className="input" type="number" min={0} max={60} step={1} required value={reminderValue} onChange={(event) => setReminderValue(event.target.value)} />
          <span className="field__hint">De 0 a 60 dias. O mesmo valor é usado nos alertas do casal, lembretes por e-mail e sinalização do painel.</span>
        </label>
        <label className="field management__alert-field">
          <span className="field__label">Antecedência máxima para a data do casamento</span>
          <input className="input" type="number" min={1} max={3650} step={1} required value={maxAdvanceValue} onChange={(event) => setMaxAdvanceValue(event.target.value)} />
          <span className="field__hint">De 1 a 3650 dias. Impede cadastro, orçamento e alteração de contrato para datas mais distantes.</span>
        </label>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <div className="savebar">
          <span className={`savebar__status ${dirty ? "is-dirty" : ""}`} role="status">{dirty ? "Alterações não salvas" : "Sem alterações"}</span>
          <button className="btn btn--secondary" type="button" disabled={!dirty || busy} onClick={() => {
            setReminderValue(String(savedReminderLeadDays));
            setMaxAdvanceValue(String(savedMaxAdvanceDays));
            setError("");
          }}>Descartar alterações</button>
          <button className="btn btn--primary" type="submit" disabled={!dirty || busy}>{busy ? "Salvando..." : "Salvar configuração"}</button>
        </div>
      </form>
    </section>
  );
}
