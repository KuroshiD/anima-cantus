"use client";

import { forgotPasswordSchema, isIsoOnOrAfter, LEGAL_VERSION, localIsoDate, loginSchema, registerSchema } from "@anima/shared";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiSend, readError, rememberCsrf } from "../lib/client-api";
import { Icon } from "./icons";

type AccessMode = "login" | "register" | "forgot";
type FieldErrors = Record<string, string>;

function errorsFromIssues(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  return Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message]));
}

export function AccessForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>("login");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [requestError, setRequestError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [phone, setPhone] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    if (window.location.hash === "#cadastro") setMode("register");
  }, []);

  useEffect(() => {
    document.title = `${mode === "register" ? "Criar conta" : mode === "forgot" ? "Recuperar senha" : "Entrar"} — Anima Cantus`;
  }, [mode]);

  function changeMode(nextMode: AccessMode) {
    setMode(nextMode);
    setErrors({});
    setRequestError("");
    setNotice("");
    window.history.replaceState(null, "", nextMode === "register" ? "#cadastro" : window.location.pathname + window.location.search);
  }

  function clearFieldError(name: string) {
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setRequestError("");
    setNotice("");

    if (mode === "forgot") {
      const parsed = forgotPasswordSchema.safeParse({ email });
      if (!parsed.success) {
        setErrors(errorsFromIssues(parsed.error.issues));
        return;
      }
      setBusy(true);
      try {
        const response = await apiSend("/auth/recuperar-senha", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        if (!response.ok) {
          setRequestError(await readError(response));
          return;
        }
        const result = (await response.json()) as { message: string };
        setNotice(result.message);
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : "Não foi possível solicitar a recuperação de senha.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "login") {
      const parsed = loginSchema.safeParse({ email, password, rememberMe });
      if (!parsed.success) {
        setErrors(errorsFromIssues(parsed.error.issues));
        return;
      }
      setBusy(true);
      try {
        const response = await apiSend("/auth/login", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        if (!response.ok) {
          setRequestError(await readError(response));
          return;
        }
        const result = (await response.json()) as { role: "COUPLE" | "ADMIN"; csrfToken: string };
        if (!result.csrfToken) {
          setRequestError("A API não retornou o token de segurança da sessão.");
          return;
        }
        rememberCsrf(result.csrfToken);
        if (result.role === "COUPLE") {
          router.replace("/jornada");
          router.refresh();
          return;
        }
        router.replace("/admin");
        router.refresh();
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : "Não foi possível entrar.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const parsed = registerSchema.safeParse({
      partnerOne: firstName,
      partnerTwo: secondName,
      email,
      password,
      phone,
      weddingDate,
      termsVersion: termsAccepted ? LEGAL_VERSION : "",
    });
    const nextErrors: FieldErrors = parsed.success ? {} : errorsFromIssues(parsed.error.issues);
    if (weddingDate && !isIsoOnOrAfter(weddingDate, localIsoDate(new Date()))) {
      nextErrors.weddingDate = "Escolha uma data a partir de hoje.";
    }
    if (password !== passwordConfirmation) nextErrors.passwordConfirmation = "As senhas não coincidem.";
    if (!termsAccepted) nextErrors.terms = "Aceite os termos para continuar.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!parsed.success) return;
    setBusy(true);
    try {
      const response = await apiSend("/auth/register", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setRequestError(await readError(response));
        return;
      }
      router.push(`/verificar-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  function fieldError(name: string): string {
    return errors[name] ?? "";
  }

  function inputError(name: string): { "aria-invalid"?: true; "aria-describedby"?: string } {
    const message = fieldError(name);
    return message
      ? { "aria-invalid": true, "aria-describedby": `${name}-error` }
      : {};
  }

  return (
    <div className="auth">
      <aside className="auth__panel">
        <a className="auth__brand" href="/acesso" aria-label="Anima Cantus">
          <span>Anima</span><span>Cantus</span>
        </a>

        <svg className="auth__staff" viewBox="0 0 800 100" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1">
            <line x1="0" y1="10" x2="800" y2="10" />
            <line x1="0" y1="30" x2="800" y2="30" />
            <line x1="0" y1="50" x2="800" y2="50" />
            <line x1="0" y1="70" x2="800" y2="70" />
            <line x1="0" y1="90" x2="800" y2="90" />
          </g>
        </svg>

        <div className="auth__quote">
          <p className="auth__quote-text">A música acompanha cada etapa da história de vocês.</p>
        </div>
      </aside>

      <main className="auth__main">
        <div className="auth__box">
          <p className="eyebrow auth__eyebrow">Área do casal</p>
          <h1 className="heading-serif auth__title">
            {mode === "register" ? "Criem sua conta" : mode === "forgot" ? "Recuperar senha" : "Bem-vindos de volta"}
          </h1>
          <p className="auth__sub">
            {mode === "register"
              ? "Comecem a organizar a música da cerimônia."
              : mode === "forgot"
                ? "Enviaremos um link para redefinir sua senha."
                : "Entrem para continuar a jornada de vocês."}
          </p>

          {mode !== "forgot" ? (
            <div className="auth__tabs" role="tablist" aria-label="Acesso">
              <button
                className="auth__tab"
                id="tab-login"
                role="tab"
                type="button"
                aria-controls="access-panel"
                aria-selected={mode === "login"}
                tabIndex={mode === "login" ? 0 : -1}
                onClick={() => changeMode("login")}
              >
                Entrar
              </button>
              <button
                className="auth__tab"
                id="tab-register"
                role="tab"
                type="button"
                aria-controls="access-panel"
                aria-selected={mode === "register"}
                tabIndex={mode === "register" ? 0 : -1}
                onClick={() => changeMode("register")}
              >
                Criar conta
              </button>
            </div>
          ) : (
            <div className="auth__tabs">
              <button className="auth__tab" type="button" onClick={() => changeMode("login")}>Voltar para entrar</button>
            </div>
          )}

          {notice ? (
            <p className="field__hint" role="status">
              {notice}
              {mode === "forgot" ? <> <Link className="link" href={`/redefinir-senha?email=${encodeURIComponent(email)}`}>Reenviar ou abrir a página de recuperação</Link></> : null}
            </p>
          ) : null}
          {requestError ? <p className="field__error" role="alert">{requestError}</p> : null}

          <form
            className="form"
            id="access-panel"
            role={mode === "forgot" ? undefined : "tabpanel"}
            aria-labelledby={mode === "forgot" ? undefined : mode === "register" ? "tab-register" : "tab-login"}
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            {mode === "register" ? (
              <>
                <div className="form__row">
                  <div className="field">
                    <label className="field__label" htmlFor="partner-one">Seu nome</label>
                    <input
                      className="input"
                      id="partner-one"
                      name="partnerOne"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Marina"
                      value={firstName}
                      {...inputError("partnerOne")}
                      onChange={(event) => {
                        setFirstName(event.target.value);
                        clearFieldError("partnerOne");
                      }}
                    />
                    {fieldError("partnerOne") ? <p className="field__error" id="partnerOne-error">{fieldError("partnerOne")}</p> : null}
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="partner-two">Nome do(a) parceiro(a)</label>
                    <input
                      className="input"
                      id="partner-two"
                      name="partnerTwo"
                      type="text"
                      autoComplete="off"
                      placeholder="Rafael"
                      value={secondName}
                      {...inputError("partnerTwo")}
                      onChange={(event) => {
                        setSecondName(event.target.value);
                        clearFieldError("partnerTwo");
                      }}
                    />
                    {fieldError("partnerTwo") ? <p className="field__error" id="partnerTwo-error">{fieldError("partnerTwo")}</p> : null}
                  </div>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="phone">Telefone com DDD</label>
                  <input
                    className="input"
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(16) 99999-9999"
                    value={phone}
                    {...inputError("phone")}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      clearFieldError("phone");
                    }}
                  />
                  {fieldError("phone") ? <p className="field__error" id="phone-error">{fieldError("phone")}</p> : null}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="wedding-date">Data do casamento</label>
                  <input
                    className="input"
                    id="wedding-date"
                    name="weddingDate"
                    type="date"
                    autoComplete="off"
                    value={weddingDate}
                    {...inputError("weddingDate")}
                    onChange={(event) => {
                      setWeddingDate(event.target.value);
                      clearFieldError("weddingDate");
                    }}
                  />
                  {fieldError("weddingDate") ? <p className="field__error" id="weddingDate-error">{fieldError("weddingDate")}</p> : null}
                </div>
              </>
            ) : null}

            <div className="field">
              <label className="field__label" htmlFor="email">E-mail</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                {...inputError("email")}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
              />
              {fieldError("email") ? <p className="field__error" id="email-error">{fieldError("email")}</p> : null}
            </div>

            {mode !== "forgot" ? (
              <div className="field">
                <label className="field__label" htmlFor="password">Senha</label>
                <div className="field__control">
                  <input
                    className="input has-toggle"
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    placeholder={mode === "register" ? "Mínimo de 8 caracteres" : "Sua senha"}
                    value={password}
                    {...inputError("password")}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearFieldError("password");
                      if (passwordConfirmation) clearFieldError("passwordConfirmation");
                    }}
                  />
                  <button
                    className="field__toggle"
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    <Icon id={showPassword ? "i-eye-off" : "i-eye"} />
                  </button>
                </div>
                {fieldError("password") ? <p className="field__error" id="password-error">{fieldError("password")}</p> : null}
                {mode === "register" ? <p className="field__hint">Use pelo menos 8 caracteres, com letras e números.</p> : null}
              </div>
            ) : null}

            {mode === "register" ? (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="password-confirmation">Confirmar senha</label>
                  <div className="field__control">
                    <input
                      className="input has-toggle"
                      id="password-confirmation"
                      name="passwordConfirmation"
                      type={showConfirmation ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      value={passwordConfirmation}
                      {...inputError("passwordConfirmation")}
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value);
                        clearFieldError("passwordConfirmation");
                      }}
                    />
                    <button
                      className="field__toggle"
                      type="button"
                      aria-label={showConfirmation ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                      onClick={() => setShowConfirmation((visible) => !visible)}
                    >
                      <Icon id={showConfirmation ? "i-eye-off" : "i-eye"} />
                    </button>
                  </div>
                  {fieldError("passwordConfirmation") ? <p className="field__error" id="passwordConfirmation-error">{fieldError("passwordConfirmation")}</p> : null}
                </div>
                <label className={`check${fieldError("terms") ? " is-invalid" : ""}`} title={fieldError("terms")}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    aria-invalid={fieldError("terms") ? true : undefined}
                    aria-describedby={fieldError("terms") ? "terms-error" : undefined}
                    onChange={(event) => {
                      setTermsAccepted(event.target.checked);
                      clearFieldError("terms");
                    }}
                  />
                  <span>
                    Li e concordo com os <a className="link" href="/termos" target="_blank" rel="noreferrer">Termos de uso</a> e a{" "}
                    <a className="link" href="/privacidade" target="_blank" rel="noreferrer">Política de privacidade</a>.
                  </span>
                </label>
                {fieldError("terms") ? <p className="field__error" id="terms-error">{fieldError("terms")}</p> : null}
              </>
            ) : null}

            {mode === "login" ? (
              <div className="form__aux">
                <label className="check" style={{ color: "var(--ink)" }}>
                  <input type="checkbox" name="rememberMe" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Manter conectado
                </label>
                <button className="link" type="button" onClick={() => changeMode("forgot")}>Esqueci a senha</button>
              </div>
            ) : null}

            <button className="btn btn--primary form__submit" type="submit" disabled={busy}>
              {busy
                ? mode === "register" ? "Criando conta..." : mode === "forgot" ? "Enviando..." : "Entrando..."
                : mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar link" : "Entrar"}
              <Icon id="i-arrow-right" />
            </button>

            {mode === "login" ? (
              <p className="form__switch">
                Ainda não têm conta?{" "}
                <button className="link" type="button" onClick={() => changeMode("register")}>Criar conta</button>
              </p>
            ) : mode === "register" ? (
              <p className="form__switch">
                Já têm conta?{" "}
                <button className="link" type="button" onClick={() => changeMode("login")}>Entrar</button>
              </p>
            ) : null}
          </form>

          <p className="auth__foot">Seus dados são usados apenas para organizar a música da cerimônia de vocês. <Link className="link" href="/orcamento">Peça um orçamento</Link>.</p>
        </div>
      </main>
    </div>
  );
}
