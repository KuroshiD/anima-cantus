"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiSend, readError } from "../lib/client-api";
import { Icon } from "./icons";

type VerifyState = "checking" | "success" | "invalid" | "pending";

export function EmailVerification({ token, initialEmail }: { token: string; initialEmail: string }) {
  const [state, setState] = useState<VerifyState>(token ? "checking" : "pending");
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.title = "Confirmar e-mail — Anima Cantus";
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const response = await apiSend("/auth/verificar-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (!active) return;
        if (!response.ok) {
          setError(await readError(response));
          setState("invalid");
          return;
        }
        setState("success");
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o e-mail.");
          setState("invalid");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiSend("/auth/reenviar-verificacao-email", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const result = (await response.json()) as { message: string };
      setMessage(result.message);
      setCooldown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível solicitar outro link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__panel">
        <Link className="auth__brand" href="/acesso" aria-label="Anima Cantus"><span>Anima</span><span>Cantus</span></Link>
        <svg className="auth__staff" viewBox="0 0 800 100" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1">
            <line x1="0" y1="10" x2="800" y2="10" /><line x1="0" y1="30" x2="800" y2="30" />
            <line x1="0" y1="50" x2="800" y2="50" /><line x1="0" y1="70" x2="800" y2="70" />
            <line x1="0" y1="90" x2="800" y2="90" />
          </g>
        </svg>
        <div className="auth__quote"><p className="auth__quote-text">A música acompanha cada etapa da história de vocês.</p></div>
      </aside>
      <main className="auth__main">
        <div className="auth__box">
          {state === "checking" ? (
            <>
              <p className="eyebrow eyebrow--green">Confirmar e-mail</p>
              <h1 className="heading-serif auth__title">Validando seu link</h1>
              <p className="auth__sub" role="status">Estamos confirmando seu endereço de e-mail...</p>
            </>
          ) : null}
          {state === "success" ? (
            <>
              <span className="status-icon"><Icon id="i-check" /></span>
              <p className="eyebrow eyebrow--green">Conta confirmada</p>
              <h1 className="heading-serif auth__title">E-mail confirmado</h1>
              <p className="auth__sub">Tudo pronto. Entre para continuar a jornada de vocês.</p>
              <div className="auth__actions"><Link className="btn btn--primary" href="/acesso">Entrar <Icon id="i-arrow-right" /></Link></div>
            </>
          ) : null}
          {state === "invalid" ? (
            <>
              <span className="status-icon status-icon--error"><Icon id="i-alert" /></span>
              <p className="eyebrow eyebrow--green">Confirmar e-mail</p>
              <h1 className="heading-serif auth__title">Link inválido ou expirado</h1>
              <p className="auth__sub">{error || "Este link não pode mais ser usado. Solicite um novo para continuar."}</p>
              <div className="auth__actions">
                <button className="btn btn--secondary" type="button" onClick={() => setState("pending")}>Solicitar novo link</button>
                <Link className="link" href="/acesso">Voltar para entrar</Link>
              </div>
            </>
          ) : null}
          {state === "pending" ? (
            <>
              <span className="status-icon"><Icon id="i-mail" /></span>
              <p className="eyebrow eyebrow--green">Confirme seu cadastro</p>
              <h1 className="heading-serif auth__title">Verifique seu e-mail</h1>
              <p className="auth__sub">Enviamos um link para confirmar sua conta. Se precisar, informe seu e-mail para solicitar outro.</p>
              <form className="form" style={{ marginTop: "1.75rem" }} onSubmit={(event) => void resend(event)}>
                <div className="field">
                  <label className="field__label" htmlFor="verification-email">E-mail</label>
                  <input className="input" id="verification-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                {message ? <p className="field__hint" role="status">{message}</p> : null}
                {error ? <p className="field__error" role="alert">{error}</p> : null}
                <button className="btn btn--secondary form__submit" type="submit" disabled={busy || cooldown > 0}>
                  {busy ? "Enviando..." : cooldown > 0 ? `Solicitar novamente em ${cooldown}s` : "Reenviar e-mail"}
                </button>
                <p className="form__switch"><Link className="link" href="/acesso">Voltar para entrar</Link></p>
              </form>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
