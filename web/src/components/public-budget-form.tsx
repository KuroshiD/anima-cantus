"use client";

import Link from "next/link";
import { budgetSchema } from "@anima/shared";
import { useState, type FormEvent } from "react";
import { apiSend, readError } from "../lib/client-api";

type BudgetResult = { message: string; whatsAppUrl: string };

export function PublicBudgetForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [venue, setVenue] = useState("");
  const [hasPlanner, setHasPlanner] = useState(false);
  const [source, setSource] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Aceite o uso dos dados para receber o orçamento.");
      return;
    }
    if (website) {
      setResult({ message: "Pedido recebido.", whatsAppUrl: "" });
      return;
    }
    const parsed = budgetSchema.safeParse({ name, email, phone, weddingDate, venue, hasPlanner, source });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setBusy(true);
    try {
      const response = await apiSend("/orcamentos", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setResult((await response.json()) as BudgetResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o pedido agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setWeddingDate("");
    setVenue("");
    setHasPlanner(false);
    setSource("");
    setConsent(false);
    setWebsite("");
    setResult(null);
    setError("");
  }

  return (
    <>
      {result ? (
        <section className="card quote__sent" tabIndex={-1} aria-live="polite">
          <span className="status-icon"><svg className="icon" aria-hidden="true"><use href="#i-check" /></svg></span>
          <h2 className="heading-serif heading-serif--lg">Pedido enviado</h2>
          <p className="text-muted quote__sent-message">{result.message}</p>
          <div className="quote__sent-actions">
            {result.whatsAppUrl ? <a className="btn btn--primary" href={result.whatsAppUrl} target="_blank" rel="noreferrer">Continuar pelo WhatsApp</a> : null}
            <Link className="btn btn--secondary" href="/acesso">Ir para a área do casal</Link>
            <button className="btn btn--secondary" type="button" onClick={reset}>Enviar outro pedido</button>
          </div>
        </section>
      ) : (
        <form className="card form-card" onSubmit={(event) => void submit(event)} noValidate>
          <header className="form-card__head">
            <h2 className="heading-serif heading-serif--md">Sobre o casamento</h2>
            <p>Os campos básicos bastam. Os demais ajudam a preparar uma proposta mais precisa.</p>
          </header>
          <section className="form-section" aria-labelledby="budget-contact">
            <h3 className="form-section__title" id="budget-contact">Contato</h3>
            <div className="form-grid">
              <label className="field field--full"><span className="field__label">Nome (do casal ou de quem pede)</span><input className="input" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="field"><span className="field__label">E-mail (opcional)</span><input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label className="field"><span className="field__label">Telefone / WhatsApp</span><input className="input" type="tel" autoComplete="tel" inputMode="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            </div>
          </section>
          <section className="form-section" aria-labelledby="budget-ceremony">
            <h3 className="form-section__title" id="budget-ceremony">Cerimônia</h3>
            <div className="form-grid">
              <label className="field"><span className="field__label">Data prevista (opcional)</span><input className="input" type="date" value={weddingDate} onChange={(event) => setWeddingDate(event.target.value)} /></label>
              <label className="field field--full"><span className="field__label">Local da cerimônia (opcional)</span><input className="input" maxLength={160} placeholder="Igreja, capela, espaço de eventos…" value={venue} onChange={(event) => setVenue(event.target.value)} /></label>
            </div>
            <label className="check quote__planner"><input type="checkbox" checked={hasPlanner} onChange={(event) => setHasPlanner(event.target.checked)} /><span>Já temos cerimonialista / assessoria</span></label>
          </section>
          <section className="form-section" aria-labelledby="budget-origin">
            <h3 className="form-section__title" id="budget-origin">Como podemos ajudar</h3>
            <label className="field"><span className="field__label">Como conheceu a Anima Cantus?</span><input className="input" required minLength={2} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Ex.: indicação, Instagram, pesquisa…" /></label>
          </section>
          <div className="quote__honeypot" aria-hidden="true"><label>Não preencha este campo<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div>
          <label className="check quote__consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>Concordo que a Anima Cantus use esses dados para responder ao meu pedido, conforme a <Link className="link" href="/privacidade" target="_blank">Política de privacidade</Link>.</span>
          </label>
          {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
          <div className="form-actions form-actions__right">
            <button className="btn btn--primary form__submit" type="submit" disabled={busy}>{busy ? "Enviando..." : "Solicitar orçamento"}<svg className="icon" aria-hidden="true"><use href="#i-arrow-right" /></svg></button>
          </div>
        </form>
      )}
    </>
  );
}
