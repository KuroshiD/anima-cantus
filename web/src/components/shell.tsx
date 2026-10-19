"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "./icons";
import { apiSend, clearCsrf, readError } from "../lib/client-api";

const links = [
  { href: "/jornada", label: "Minha jornada", icon: "i-home" },
  { href: "/contrato", label: "Contrato", icon: "i-file" },
  { href: "/repertorio", label: "Repertório", icon: "i-list-music" },
];

function Bell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<{ id: string; title: string; detail: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;
    setLoading(true);
    setError("");
    try {
      const response = await apiSend("/alertas");
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data) || !data.every((item) =>
        typeof item === "object" && item !== null &&
        typeof item.id === "string" && typeof item.title === "string" && typeof item.detail === "string"
      )) {
        setError("A API retornou uma lista de notificações inválida.");
        return;
      }
      setAlerts(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="notification">
      <button className="icon-btn" type="button" aria-label="Notificações" aria-expanded={open} onClick={() => void toggle()}>
        <Icon id="i-bell" />
      </button>
      {open ? (
        <section className="notification__panel" aria-label="Notificações" aria-live="polite">
          <h2 className="notification__title">Notificações</h2>
          {loading ? <p className="notification__message">Carregando...</p> : null}
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          {!loading && !error && alerts.length === 0 ? <p className="notification__message">Vocês não têm notificações no momento.</p> : null}
          {!loading && !error && alerts.length > 0 ? (
            <ul className="notification__list">
              {alerts.map((alert) => <li key={alert.id}><strong>{alert.title}</strong><span>{alert.detail}</span></li>)}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function CoupleShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const logoutDialog = useRef<HTMLDialogElement>(null);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await apiSend("/auth/logout", { method: "POST" });
      if (!response.ok) {
        setLogoutError(await readError(response));
        return;
      }
      clearCsrf();
      logoutDialog.current?.close();
      router.replace("/acesso");
      router.refresh();
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Não foi possível sair da conta.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/jornada" aria-label="Anima Cantus — início">
          <span>Anima</span> <span>Cantus</span>
        </Link>
        <div className="sidebar__actions">
          <Bell />
          <button className="icon-btn" type="button" aria-label="Sair da conta" onClick={() => logoutDialog.current?.showModal()}>
            <Icon id="i-logout" />
          </button>
        </div>
        <nav className="nav" aria-label="Principal">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              <Icon id={link.icon} />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar__foot">
          <p className="sidebar__user"><span>Conectados como</span><strong>{email}</strong></p>
          <button className="btn btn--secondary btn--sm sidebar__logout" type="button" onClick={() => logoutDialog.current?.showModal()}>
            <Icon id="i-logout" />Sair da conta
          </button>
        </div>
      </aside>
      <main className="main" id="conteudo">
        <div className="container">{children}</div>
      </main>
      <dialog className="dialog" ref={logoutDialog} aria-labelledby="logout-title">
        <h2 className="heading-serif heading-serif--md" id="logout-title">Sair da conta?</h2>
        <p className="dialog__text text-muted">Vocês precisarão entrar novamente para acessar o contrato e o repertório.</p>
        {logoutError ? <p className="field__error" role="alert">{logoutError}</p> : null}
        <div className="dialog__actions">
          <button className="btn btn--secondary" type="button" disabled={loggingOut} onClick={() => logoutDialog.current?.close()}>
            Cancelar
          </button>
          <button className="btn btn--primary" type="button" disabled={loggingOut} onClick={() => void logout()}>
            {loggingOut ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
      </div>
      <Bell />
    </header>
  );
}
