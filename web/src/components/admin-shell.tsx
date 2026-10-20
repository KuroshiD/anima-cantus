"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend, clearCsrf, readError } from "../lib/client-api";
import { Icon } from "./icons";

const links = [
  { href: "/admin", label: "Jornadas", icon: "i-home" },
  { href: "/admin/servicos", label: "Serviços", icon: "i-file" },
  { href: "/admin/conteudo", label: "Conteúdo", icon: "i-file-check" },
  { href: "/admin/dicas", label: "Dicas", icon: "i-list-music" },
  { href: "/admin/galeria", label: "Galeria", icon: "i-image" },
  { href: "/admin/alertas", label: "Alertas", icon: "i-bell" },
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await apiSend("/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      clearCsrf();
      router.replace("/acesso");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sair da conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/admin" aria-label="Anima Cantus — administração">
          <span>Anima</span><span>Cantus</span>
        </Link>
        <div className="sidebar__actions">
          <button className="icon-btn" type="button" aria-label="Sair da conta" onClick={() => void logout()} disabled={busy}>
            <Icon id="i-logout" />
          </button>
        </div>
        <nav className="nav" aria-label="Administração">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`)) ? "page" : undefined}
            >
              <Icon id={link.icon} />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar__foot">
          <p className="sidebar__user"><span>Conectado como</span><strong>{email}</strong></p>
          <button className="btn btn--secondary btn--sm sidebar__logout" type="button" onClick={() => void logout()} disabled={busy}>
            <Icon id="i-logout" />{busy ? "Saindo..." : "Sair da conta"}
          </button>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
        </div>
      </aside>
      <main className="admin-shell__main">{children}</main>
    </div>
  );
}
