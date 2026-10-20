"use client";

import { serviceWriteSchema } from "@anima/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiSend, readError } from "../lib/client-api";
import type { ServiceItemView } from "../lib/types";

type Draft = {
  name: string;
  description: string;
  kind: ServiceItemView["kind"];
  price: string;
  active: boolean;
  sortOrder: string;
};

const blank: Draft = { name: "", description: "", kind: "SERVICO", price: "", active: true, sortOrder: "0" };

function priceLabel(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function priceInCents(value: string): number {
  return Math.round(Number(value) * 100);
}

export function AdminServices({ services }: { services: ServiceItemView[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<ServiceItemView | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((editing || creating) && !dialog.current?.open) dialog.current?.showModal();
    if (!editing && !creating && dialog.current?.open) dialog.current.close();
  }, [editing, creating]);

  function openNew() {
    setError("");
    setDraft(blank);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(service: ServiceItemView) {
    setError("");
    setDraft({
      name: service.name,
      description: service.description ?? "",
      kind: service.kind,
      price: (service.priceCents / 100).toFixed(2),
      active: service.active,
      sortOrder: String(service.sortOrder),
    });
    setCreating(false);
    setEditing(service);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const input = {
      name: draft.name,
      description: draft.description,
      kind: draft.kind,
      priceCents: priceInCents(draft.price),
      active: draft.active,
      sortOrder: Number(draft.sortOrder),
    };
    const parsed = serviceWriteSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados do serviço.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiSend(editing ? `/admin/servicos/${editing.id}` : "/admin/servicos", {
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
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o serviço.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(service: ServiceItemView) {
    setError("");
    try {
      const response = await apiSend(`/admin/servicos/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: service.name,
          description: service.description ?? "",
          kind: service.kind,
          priceCents: service.priceCents,
          active: !service.active,
          sortOrder: service.sortOrder,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o serviço.");
    }
  }

  return (
    <section className="admin__main">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Serviços</h1>
          <p className="text-muted management__intro">Gerencie os serviços que o casal escolhe ao montar o contrato.</p>
        </div>
        <button className="btn btn--primary" type="button" onClick={openNew}>Novo serviço</button>
      </header>
      <p className="alert management__notice">Serviços usados em contratos não podem ser excluídos. Desative-os para removê-los de novas contratações; contratos gerados mantêm os valores registrados.</p>
      {error && !dialog.current?.open ? <p className="field__error" role="alert">{error}</p> : null}
      <div className="admin__table-scroll">
        <table className="admin__table">
          <thead><tr><th>Serviço</th><th>Tipo</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td><strong>{service.name}</strong><span>{service.description || "—"}</span></td>
                <td>{service.kind === "PACOTE" ? "Pacote base" : service.kind === "ADICIONAL" ? "Adicional" : "Serviço"}</td>
                <td>{priceLabel(service.priceCents)}</td>
                <td><span className={`pill ${service.active ? "pill--done" : "pill--pending"}`}>{service.active ? "Ativo" : "Inativo"}</span></td>
                <td className="management__actions">
                  <button className="btn btn--secondary btn--sm" type="button" onClick={() => openEdit(service)}>Editar</button>
                  <button className="link" type="button" onClick={() => void toggleActive(service)}>{service.active ? "Desativar" : "Ativar"}</button>
                </td>
              </tr>
            ))}
            {services.length === 0 ? <tr><td colSpan={5} className="text-muted">Nenhum serviço cadastrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <dialog className="dialog dialog--form" ref={dialog} onClose={close} aria-labelledby="service-dialog-title">
        <h2 className="heading-serif heading-serif--md" id="service-dialog-title">{editing ? "Editar serviço" : "Novo serviço"}</h2>
        <form className="form" onSubmit={(event) => void save(event)}>
          <label className="field"><span className="field__label">Nome do serviço</span><input className="input" required minLength={2} maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="field"><span className="field__label">Descrição</span><textarea className="input admin__textarea" maxLength={300} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="field">
            <span className="field__label">Tipo</span>
            <select className="input" value={draft.kind} onChange={(event) => {
              const kind = event.target.value;
              if (kind === "PACOTE" || kind === "SERVICO" || kind === "ADICIONAL") setDraft({ ...draft, kind });
            }}>
              <option value="PACOTE">Pacote base</option><option value="SERVICO">Serviço</option><option value="ADICIONAL">Adicional</option>
            </select>
          </label>
          <label className="field"><span className="field__label">Preço (R$)</span><input className="input" type="number" min="0" step="0.01" required value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label>
          <label className="field"><span className="field__label">Ordem de exibição</span><input className="input" type="number" step="1" required value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Disponível para contratação</span></label>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <div className="dialog__actions">
            <button className="btn btn--secondary" type="button" onClick={close} disabled={busy}>Cancelar</button>
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
