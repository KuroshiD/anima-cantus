"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { forgotPasswordSchema, resetPasswordSchema } from "@anima/shared";
import { apiSend, readError } from "../lib/client-api";
import { Icon } from "./icons";

type ResetState = "request" | "sent" | "reset" | "done" | "invalid";

export function PasswordReset({ token, initialEmail }: { token: string; initialEmail: string }) {
  const [state, setState] = useState<ResetState>(token ? "reset" : "request");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.title = "Redefinir senha — Anima Cantus";
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendResetLink() {
    setError("");
    setBusy(true);
    try {
      const response = await apiSend("/auth/recuperar-senha", { method: "POST", body: JSON.stringify({ email }) });
      if (!response.ok) {
        setError(await readError(response));
        return false;
      }
      setState("sent");
      setCooldown(60);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível solicitar o link.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe um e-mail válido.");
      return;
    }
    await sendResetLink();
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados e tente novamente.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiSend("/auth/redefinir-senha", { method: "POST", body: JSON.stringify(parsed.data) });
      if (!response.ok) {
        const detail = await readError(response);
        setError(detail);
        if (/inválido|expirado|usado/i.test(detail)) setState("invalid");
        return;
      }
      setState("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a senha.");
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
          {state === "request" ? (
            <>
              <p className="eyebrow eyebrow--green">Recuperar acesso</p>
              <h1 className="heading-serif auth__title">Esqueceu a senha?</h1>
              <p className="auth__sub">Informe o e-mail da conta e enviaremos um link para criar uma nova senha.</p>
              <form className="form" style={{ marginTop: "1.75rem" }} onSubmit={(event) => void submitRequest(event)}>
                <div className="field">
                  <label className="field__label" htmlFor="reset-email">E-mail</label>
                  <input className="input" id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                {error ? <p className="field__error" role="alert">{error}</p> : null}
                <button className="btn btn--primary form__submit" type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar link"} <Icon id="i-arrow-right" /></button>
                <p className="form__switch"><Link className="link" href="/acesso">Voltar para entrar</Link></p>
              </form>
            </>
          ) : null}
          {state === "sent" ? (
            <>
              <span className="status-icon"><Icon id="i-mail" /></span>
              <p className="eyebrow eyebrow--green">Recuperar acesso</p>
              <h1 className="heading-serif auth__title">Verifique seu e-mail</h1>
              <p className="auth__sub">Se houver uma conta com <strong>{email}</strong>, enviamos um link para redefinir a senha. Ele tem prazo de validade.</p>
              <div className="auth__actions">
                <p className="field__hint" role="status">Se o endereço estiver cadastrado, receberá um link para redefinir a senha.</p>
                {error ? <p className="field__error" role="alert">{error}</p> : null}
                <button className="btn btn--secondary" type="button" disabled={busy || cooldown > 0} onClick={() => void sendResetLink()}>
                  {busy ? "Enviando..." : cooldown > 0 ? `Solicitar novamente em ${cooldown}s` : "Reenviar e-mail"}
                </button>
                <Link className="link" href="/acesso">Voltar para entrar</Link>
              </div>
            </>
          ) : null}
          {state === "reset" ? (
            <>
              <p className="eyebrow eyebrow--green">Recuperar acesso</p>
              <h1 className="heading-serif auth__title">Crie uma nova senha</h1>
              <p className="auth__sub">Escolha uma senha para voltar a acessar a área do casal.</p>
              <form className="form" style={{ marginTop: "1.75rem" }} onSubmit={(event) => void submitReset(event)}>
                <div className="field">
                  <label className="field__label" htmlFor="new-password">Nova senha</label>
                  <input className="input" id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
                  <p className="field__hint">Use ao menos 8 caracteres, com letras e números.</p>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="confirm-password">Confirmar nova senha</label>
                  <input className="input" id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                </div>
                {error ? <p className="field__error" role="alert">{error}</p> : null}
                <button className="btn btn--primary form__submit" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"} <Icon id="i-arrow-right" /></button>
              </form>
            </>
          ) : null}
          {state === "done" ? (
            <>
              <span className="status-icon"><Icon id="i-check" /></span>
              <p className="eyebrow eyebrow--green">Recuperar acesso</p>
              <h1 className="heading-serif auth__title">Senha atualizada</h1>
              <p className="auth__sub">Pronto! Entre com a nova senha para continuar a jornada de vocês.</p>
              <div className="auth__actions"><Link className="btn btn--primary" href="/acesso">Entrar <Icon id="i-arrow-right" /></Link></div>
            </>
          ) : null}
          {state === "invalid" ? (
            <>
              <span className="status-icon status-icon--error"><Icon id="i-alert" /></span>
              <p className="eyebrow eyebrow--green">Recuperar acesso</p>
              <h1 className="heading-serif auth__title">Link inválido ou expirado</h1>
              <p className="auth__sub">{error || "Este link de redefinição não vale mais. Peça um novo para continuar."}</p>
              <div className="auth__actions">
                <Link className="btn btn--primary" href="/redefinir-senha">Pedir novo link</Link>
                <Link className="btn btn--secondary" href="/acesso">Voltar para entrar</Link>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
