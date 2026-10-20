"use client";

import {
  contractDraftSchema,
  formatBRL,
  isIsoOnOrAfter,
  localIsoDate,
  valorPorExtenso,
  type ContractDraftInput,
} from "@anima/shared";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { apiSend, readError } from "../lib/client-api";
import type { ContractView } from "../lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const tabs = [
  { id: "dados", label: "Dados" },
  { id: "servicos", label: "Serviços" },
  { id: "conferencia", label: "Conferência" },
  { id: "assinatura", label: "Assinatura" },
] as const;
type ContractStep = (typeof tabs)[number]["id"];
type DraftFields = Omit<ContractDraftInput, "serviceIds">;
type DraftErrors = Partial<Record<keyof ContractDraftInput | "confirmation", string>>;

function initialStep(contract: ContractView, serviceIds: string[]): ContractStep {
  if (contract.latest || contract.files.some((file) => file.kind === "GERADO")) return "assinatura";
  const couple = contract.couple;
  const hasRequiredData = Boolean(
    couple.legalName &&
    couple.documentId &&
    couple.address &&
    couple.email &&
    couple.phone &&
    couple.weddingDate &&
    couple.weddingTime &&
    couple.venue &&
    couple.paymentTerms,
  );
  if (!hasRequiredData) return "dados";
  if (serviceIds.length) return "conferencia";
  if (contract.catalog.length) return "servicos";
  return "dados";
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isTodayOrLater(value: string, now = new Date()): boolean {
  return isIsoOnOrAfter(value, localIsoDate(now));
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

export function ContractWizard({ initial }: { initial: ContractView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packageService = initial.catalog.find((item) => item.kind === "PACOTE");
  const startingServices = Array.from(new Set([
    ...initial.serviceIds,
    ...(packageService ? [packageService.id] : []),
  ]));
  const [contract, setContract] = useState(initial);
  const [step, setStep] = useState<ContractStep>(() => initialStep(initial, startingServices));
  const [draft, setDraft] = useState<DraftFields>({
    legalName: initial.couple.legalName,
    documentId: initial.couple.documentId,
    address: initial.couple.address,
    email: initial.couple.email,
    phone: initial.couple.phone,
    weddingDate: initial.couple.weddingDate,
    weddingTime: initial.couple.weddingTime,
    venue: initial.couple.venue,
    formation: initial.couple.formation,
    paymentTerms: initial.couple.paymentTerms,
  });
  const [serviceIds, setServiceIds] = useState<string[]>(startingServices);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showGenerationNotice, setShowGenerationNotice] = useState(false);
  const locked = contract.status !== "EM_ANDAMENTO";
  const generatedFile = contract.files.find((item) => item.kind === "GERADO");
  const selectedServices = useMemo(
    () => contract.catalog.filter((item) => serviceIds.includes(item.id)),
    [contract.catalog, serviceIds],
  );
  const totalCents = Math.max(
    0,
    selectedServices.reduce((total, item) => total + item.priceCents, 0) - contract.discountCents,
  );
  const total = formatBRL(totalCents);
  const totalInWords = valorPorExtenso(totalCents);
  const canReview = serviceIds.length > 0 &&
    contractDraftSchema.safeParse({ ...draft, serviceIds }).success &&
    isTodayOrLater(draft.weddingDate);
  const canSign = Boolean(contract.latest || generatedFile || showGenerationNotice);

  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  }, []);

  useEffect(() => {
    setContract(initial);
  }, [initial]);

  useEffect(() => {
    if (locked || step !== "dados" || !serviceIds.length) return;
    const parsed = contractDraftSchema.safeParse({ ...draft, serviceIds });
    if (!parsed.success || !isTodayOrLater(parsed.data.weddingDate)) return;

    setAutoSaveMessage("Alterações pendentes");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void saveDraft(parsed.data, true);
    }, 700);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft, locked, serviceIds, step]);

  function updateField<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError("");
  }

  function validateDraft(): ContractDraftInput | null {
    const parsed = contractDraftSchema.safeParse({ ...draft, serviceIds });
    if (!parsed.success) {
      const next: DraftErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContractDraftInput;
        next[key] ??= issue.message;
      }
      setErrors(next);
      setStep(parsed.error.issues.some((issue) => issue.path[0] !== "serviceIds") ? "dados" : "servicos");
      return null;
    }

    if (!isTodayOrLater(parsed.data.weddingDate)) {
      setErrors({ weddingDate: "Escolha uma data a partir de hoje." });
      setStep("dados");
      return null;
    }

    setErrors({});
    return parsed.data;
  }

  async function saveDraft(values: ContractDraftInput, automatic = false): Promise<boolean> {
    if (locked) return false;
    if (!automatic) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      setBusy(true);
      setError("");
      setStatusMessage("");
    }
    try {
      const response = await apiSend("/contratos/me/rascunho", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const message = await readError(response);
        if (automatic) {
          setError(message);
          setAutoSaveMessage("Não foi possível salvar");
        } else {
          setError(message);
        }
        return false;
      }
      const updated = (await response.json()) as ContractView;
      setContract(updated);
      if (automatic) {
        setAutoSaveMessage("Rascunho salvo");
      } else {
        setStatusMessage("Rascunho salvo");
      }
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível salvar o contrato.";
      setError(message);
      if (automatic) setAutoSaveMessage("Não foi possível salvar");
      return false;
    } finally {
      if (!automatic) setBusy(false);
    }
  }

  async function continueToServices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = validateDraft();
    if (!values) return;
    if (serviceIds.length && !(await saveDraft(values))) return;
    setStep("servicos");
    setStatusMessage("");
  }

  async function continueToReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = validateDraft();
    if (!values) return;
    if (!(await saveDraft(values))) return;
    setStep("conferencia");
  }

  async function generateContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!confirmed) {
      setErrors({ confirmation: "Confirme que os dados estão corretos para gerar o contrato." });
      return;
    }
    const values = validateDraft();
    if (!values) return;
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const saved = await apiSend("/contratos/me/rascunho", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      if (!saved.ok) {
        setError(await readError(saved));
        return;
      }
      setContract((await saved.json()) as ContractView);

      const response = await apiSend("/contratos/me/gerar", { method: "POST" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setShowGenerationNotice(true);
      setStep("assinatura");
      router.refresh();
      window.setTimeout(() => router.refresh(), 1500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o contrato.");
    } finally {
      setBusy(false);
    }
  }

  function chooseFile(candidate?: File) {
    setError("");
    if (!candidate) return;
    const isPdf = candidate.type === "application/pdf" || /\.pdf$/i.test(candidate.name);
    if (!isPdf) {
      setError("Envie um arquivo em PDF.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("O arquivo tem mais de 10 MB. Envie um PDF menor.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(candidate);
  }

  function resetFile() {
    setFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function sendFile() {
    if (!file || !generatedFile) return;
    setBusy(true);
    setError("");
    try {
      const intent = await apiSend("/contratos/me/upload-url", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          sizeBytes: file.size,
          contentType: "application/pdf",
        }),
      });
      if (!intent.ok) {
        setError(await readError(intent));
        return;
      }
      const signed = (await intent.json()) as { url: string; key: string; headers?: Record<string, string> };
      const upload = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers ?? { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!upload.ok) {
        setError("Não foi possível enviar o arquivo ao armazenamento.");
        return;
      }
      const confirmation = await apiSend("/contratos/me/upload-confirmar", {
        method: "POST",
        body: JSON.stringify({ key: signed.key }),
      });
      if (!confirmation.ok) {
        setError(await readError(confirmation));
        return;
      }
      setSubmitted(true);
      resetFile();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o contrato. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function field(
    key: keyof DraftFields,
    label: string,
    options: {
      type?: string;
      placeholder?: string;
      full?: boolean;
      mask?: "cpf" | "phone";
      hint?: string;
    } = {},
  ) {
    const id = `contract-${key}`;
    const message = errors[key];
    const value = draft[key];
    return (
      <div className={`field${options.full ? " field--full" : ""}`} key={key}>
        <label className="field__label" htmlFor={id}>{label}</label>
        <input
          className="input"
          id={id}
          name={key}
          type={options.type ?? "text"}
          placeholder={options.placeholder}
          value={value}
          disabled={locked}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          autoComplete={key === "email" ? "email" : key === "phone" ? "tel" : undefined}
          inputMode={options.mask ? "numeric" : undefined}
          onChange={(event) => {
            const raw = event.target.value;
            const next = options.mask === "cpf"
              ? formatCpf(raw)
              : options.mask === "phone"
                ? formatPhone(raw)
                : raw;
            updateField(key, next);
          }}
        />
        {message ? <p className="field__error" id={`${id}-error`} role="alert">{message}</p> : null}
        {options.hint ? <p className="field__hint">{options.hint}</p> : null}
      </div>
    );
  }

  function Summary() {
    return (
      <aside className="card" aria-labelledby="summary-title">
        <h2 className="summary__title" id="summary-title">Resumo da contratação</h2>
        <dl aria-live="polite">
          {selectedServices.map((item) => (
            <div className="summary__row" key={item.id}>
              <dt>{item.name}</dt>
              <dd>{formatBRL(item.priceCents)}</dd>
            </div>
          ))}
        </dl>
        <div className="summary__total">
          <span className="summary__total-label">Total</span>
          <span className="summary__total-value">{total.replace(",00", "")}</span>
        </div>
        <p className="summary__words">{totalInWords}</p>
        <p className="summary__note">
          <Icon id="i-lock" />
          Os valores deste contrato ficam preservados, mesmo após futuras alterações de preço.
        </p>
      </aside>
    );
  }

  function renderTabs() {
    return (
      <nav className="tabs" aria-label="Etapas do contrato">
        {tabs.map((item) => {
          const complete = item.id === "dados"
            ? Boolean(draft.legalName && draft.documentId && draft.address && draft.email && draft.phone && draft.weddingDate && draft.weddingTime && draft.venue && draft.paymentTerms)
            : item.id === "servicos"
              ? serviceIds.length > 0
              : item.id === "conferencia"
                ? Boolean(contract.latest)
                : false;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={step === item.id ? "step" : undefined}
              disabled={
                (locked && item.id !== "assinatura") ||
                (item.id === "conferencia" && !canReview) ||
                (item.id === "assinatura" && !canSign)
              }
              onClick={() => {
                if (item.id === "assinatura") {
                  setStep(item.id);
                  return;
                }
                setStep(item.id);
              }}
            >
              {complete && item.id !== "assinatura" ? <Icon id="i-check" /> : null}
              {item.label}
            </button>
          );
        })}
      </nav>
    );
  }

  const status = submitted
    ? "Em conferência"
    : contract.status === "AGUARDANDO_VALIDACAO"
      ? "Em conferência"
      : contract.status === "CONCLUIDA"
        ? "Concluído"
        : "Aguardando assinatura";
  const submittedOrComplete = submitted || contract.status !== "EM_ANDAMENTO";

  return (
    <>
      {renderTabs()}
      {contract.uploadError ? <p className="alert alert--error" role="alert">{contract.uploadError}</p> : null}
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      {statusMessage ? <p className="alert alert--success" role="status">{statusMessage}</p> : null}

      {step === "dados" ? (
        <div className="split">
          <form className="card form-card" noValidate onSubmit={(event) => void continueToServices(event)}>
            <header className="form-card__head">
              <h2 className="heading-serif heading-serif--md">Seus dados</h2>
              <p>Usaremos essas informações para preencher o contrato. Você poderá conferir tudo antes de gerar o documento.</p>
            </header>

            <section className="form-section" aria-labelledby="contract-couple">
              <h3 className="form-section__title" id="contract-couple">Noivos</h3>
              <p className="field__hint">
                Perfil cadastrado: {contract.couple.partnerOne} &amp; {contract.couple.partnerTwo}
              </p>
              <div className="form-grid">
                {field("legalName", "Nome completo do(a) contratante", { placeholder: "Nome e sobrenome" })}
                {field("documentId", "CPF / CNPJ do(a) contratante", { placeholder: "000.000.000-00", mask: "cpf" })}
              </div>
            </section>

            <section className="form-section" aria-labelledby="contract-contact">
              <h3 className="form-section__title" id="contract-contact">Contato</h3>
              <div className="form-grid">
                {field("phone", "Telefone / WhatsApp", { placeholder: "(00) 00000-0000", mask: "phone" })}
                {field("email", "E-mail", { type: "email", placeholder: "voce@email.com" })}
              </div>
            </section>

            <section className="form-section" aria-labelledby="contract-ceremony">
              <h3 className="form-section__title" id="contract-ceremony">Cerimônia</h3>
              <div className="form-grid">
                {field("weddingDate", "Data do casamento", { type: "date" })}
                {field("weddingTime", "Horário da cerimônia", { type: "time" })}
                {field("venue", "Nome do local", { full: true, placeholder: "Igreja, capela, espaço de eventos..." })}
                {field("address", "Endereço completo do local", {
                  full: true,
                  placeholder: "Rua, número, bairro, cidade e estado",
                  hint: "Informe o endereço completo para constar no contrato.",
                })}
                {field("formation", "Formação musical", {
                  full: true,
                  placeholder: "Formação combinada com a equipe",
                  hint: "Opcional.",
                })}
              </div>
            </section>

            <section className="form-section" aria-labelledby="contract-payment">
              <h3 className="form-section__title" id="contract-payment">Pagamento</h3>
              <div className="form-grid">
                {field("paymentTerms", "Condição de pagamento", {
                  full: true,
                  placeholder: "Ex.: 50% na contratação e 50% até a data do evento",
                })}
              </div>
            </section>

            <div className="form-actions">
              <p className="form-actions__status" role="status">{autoSaveMessage}</p>
              <div className="form-actions__right">
                <button className="btn btn--primary form__submit" type="submit" disabled={busy || locked}>
                  {busy ? "Salvando..." : "Continuar"} <Icon id="i-arrow-right" />
                </button>
              </div>
            </div>
          </form>
          <aside className="card" aria-labelledby="privacy-title">
            <span className="status-icon"><Icon id="i-lock" /></span>
            <h2 className="heading-serif heading-serif--md" id="privacy-title">Seus dados estão protegidos</h2>
            <p className="text-muted" style={{ marginTop: ".5rem", fontSize: ".8125rem" }}>
              Usamos essas informações apenas para preencher o contrato e organizar a cerimônia.
            </p>
          </aside>
        </div>
      ) : null}

      {step === "servicos" ? (
        <div className="split">
          <form className="card form-card" noValidate onSubmit={(event) => void continueToReview(event)}>
            <header className="form-card__head">
              <h2 className="heading-serif heading-serif--md">Escolha os serviços</h2>
              <p>O pacote completo já está incluído. Adicione o que fizer sentido para a cerimônia de vocês.</p>
            </header>

            <fieldset className="options">
              <legend className="sr-only">Serviços do contrato</legend>
              {contract.catalog.map((service) => {
                const isPackage = service.kind === "PACOTE";
                const checked = serviceIds.includes(service.id);
                return (
                  <label className="option" key={service.id}>
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={service.id}
                      checked={checked}
                      disabled={locked || (isPackage && Boolean(packageService))}
                      onChange={(event) => {
                        setServiceIds((current) => event.target.checked
                          ? [...current, service.id]
                          : current.filter((id) => id !== service.id));
                      }}
                    />
                    <span>
                      <span className="option__name">{service.name}</span>
                      {service.description ? <><br /><span className="option__desc">{service.description}</span></> : null}
                    </span>
                    <span className="option__side">
                      <span className="option__price">{formatBRL(service.priceCents)}</span>
                      {isPackage && packageService ? <span className="pill pill--done">Incluído</span> : null}
                    </span>
                  </label>
                );
              })}
              {contract.catalog.length === 0 ? (
                <p className="field__error" role="alert">Não há serviços disponíveis no catálogo. Entre em contato com a equipe.</p>
              ) : null}
            </fieldset>

            {errors.serviceIds ? <p className="field__error" role="alert">{errors.serviceIds}</p> : null}
            <div className="form-actions">
              <div className="form-actions__right">
                <button className="btn btn--secondary" type="button" onClick={() => setStep("dados")}>
                  <Icon id="i-arrow-left" />Voltar
                </button>
                <button className="btn btn--primary form__submit" type="submit" disabled={busy || locked || !serviceIds.length}>
                  {busy ? "Salvando..." : "Continuar"} <Icon id="i-arrow-right" />
                </button>
              </div>
            </div>
          </form>
          <Summary />
        </div>
      ) : null}

      {step === "conferencia" ? (
        <>
          {!selectedServices.length ? (
            <section className="card blocked">
              <span className="status-icon status-icon--warn"><Icon id="i-alert" /></span>
              <h2 className="heading-serif heading-serif--md">Faltam algumas informações</h2>
              <p className="text-muted" style={{ margin: ".5rem 0 1.25rem" }}>
                Preencha os dados e escolha os serviços para conferir e gerar o contrato.
              </p>
              <button className="btn btn--primary" type="button" onClick={() => setStep("dados")}>
                Continuar de onde parei <Icon id="i-arrow-right" />
              </button>
            </section>
          ) : (
            <div className="split">
              <form className="card form-card" noValidate onSubmit={(event) => void generateContract(event)}>
                <header className="form-card__head">
                  <h2 className="heading-serif heading-serif--md">Confira as informações</h2>
                  <p>Revise com atenção: é com esses dados que geramos o contrato.</p>
                </header>

                <div className="review">
                  <section className="review__section">
                    <div className="review__head">
                      <h3 className="review__title">Noivos e contratante</h3>
                      <button className="link review__edit" type="button" onClick={() => setStep("dados")}>
                        <Icon id="i-pencil" />Editar
                      </button>
                    </div>
                    <dl>
                      <div><dt>Noivo(a) 1</dt><dd>{contract.couple.partnerOne}</dd></div>
                      <div><dt>Noivo(a) 2</dt><dd>{contract.couple.partnerTwo}</dd></div>
                      <div><dt>Contratante</dt><dd>{draft.legalName}</dd></div>
                      <div><dt>CPF / CNPJ</dt><dd>{draft.documentId}</dd></div>
                    </dl>
                  </section>
                  <section className="review__section">
                    <div className="review__head">
                      <h3 className="review__title">Contato</h3>
                      <button className="link review__edit" type="button" onClick={() => setStep("dados")}>
                        <Icon id="i-pencil" />Editar
                      </button>
                    </div>
                    <dl>
                      <div><dt>Telefone / WhatsApp</dt><dd>{draft.phone}</dd></div>
                      <div><dt>E-mail</dt><dd>{draft.email}</dd></div>
                    </dl>
                  </section>
                  <section className="review__section">
                    <div className="review__head">
                      <h3 className="review__title">Cerimônia</h3>
                      <button className="link review__edit" type="button" onClick={() => setStep("dados")}>
                        <Icon id="i-pencil" />Editar
                      </button>
                    </div>
                    <dl>
                      <div><dt>Data</dt><dd>{formatDate(draft.weddingDate)}</dd></div>
                      <div><dt>Horário</dt><dd>{draft.weddingTime}</dd></div>
                      <div className="wide"><dt>Local</dt><dd>{draft.venue}</dd></div>
                      <div className="wide"><dt>Endereço</dt><dd>{draft.address}</dd></div>
                      {draft.formation ? <div className="wide"><dt>Formação</dt><dd>{draft.formation}</dd></div> : null}
                      <div className="wide"><dt>Condição de pagamento</dt><dd>{draft.paymentTerms}</dd></div>
                    </dl>
                  </section>
                  <section className="review__section">
                    <div className="review__head">
                      <h3 className="review__title">Serviços</h3>
                      <button className="link review__edit" type="button" onClick={() => setStep("servicos")}>
                        <Icon id="i-pencil" />Editar
                      </button>
                    </div>
                    <dl>
                      {selectedServices.map((service) => (
                        <div key={service.id}>
                          <dt>{service.name}</dt>
                          <dd>{formatBRL(service.priceCents)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>

                <div className="confirm">
                  <label className={`check${errors.confirmation ? " is-invalid" : ""}`}>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      aria-invalid={errors.confirmation ? true : undefined}
                      aria-describedby={errors.confirmation ? "confirmation-error" : undefined}
                      onChange={(event) => {
                        setConfirmed(event.target.checked);
                        setErrors((current) => ({ ...current, confirmation: undefined }));
                      }}
                    />
                    <span>Conferi os dados e confirmo que estão corretos.</span>
                  </label>
                </div>
                {errors.confirmation ? <p className="field__error" id="confirmation-error" role="alert">{errors.confirmation}</p> : null}

                <div className="form-actions">
                  <div className="form-actions__right">
                    <button className="btn btn--secondary" type="button" onClick={() => setStep("servicos")}>
                      <Icon id="i-arrow-left" />Voltar
                    </button>
                    <button className="btn btn--primary form__submit" type="submit" disabled={busy || locked}>
                      {busy ? "Gerando contrato..." : "Gerar contrato"} <Icon id="i-arrow-right" />
                    </button>
                  </div>
                </div>
              </form>
              <Summary />
            </div>
          )}
        </>
      ) : null}

      {step === "assinatura" ? (
        <>
          {showGenerationNotice && !generatedFile ? (
            <p className="alert alert--success" role="status">
              <Icon id="i-check" />Contrato solicitado. O PDF está sendo preparado; atualize esta página em instantes.
            </p>
          ) : null}
          <div className="split">
            <section className="card" aria-labelledby="sign-title">
              <div className="sign__top">
                <span className={`pill ${submittedOrComplete ? "pill--done" : "pill--progress"}`}>{status}</span>
                <Icon id="i-file-check" />
              </div>
              <h2 className="heading-serif heading-serif--lg sign__title" id="sign-title">
                {generatedFile ? "Seu contrato está pronto" : "O PDF está a caminho"}
              </h2>
              <p className="sign__desc">Faça o download, assine digitalmente pelo GOV.BR e envie o arquivo assinado.</p>

              <div className="sign__actions">
                {generatedFile ? (
                  <>
                    <a className="btn btn--primary" href={`/api/contratos/me/arquivos/${generatedFile.id}/download`}>
                      <Icon id="i-download" />Baixar contrato
                    </a>
                    <a
                      className="btn btn--secondary"
                      href={`/api/contratos/me/arquivos/${generatedFile.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visualizar PDF
                    </a>
                  </>
                ) : (
                  <button className="btn btn--secondary" type="button" onClick={() => router.refresh()}>
                    Atualizar
                  </button>
                )}
              </div>

              <ol className="sign__steps" aria-label="Passos da assinatura">
                <li className="sign__step"><span className="marker marker--soft"><Icon id="i-check" /></span>Baixar PDF</li>
                <li className="sign__step"><span className="marker marker--soft"><Icon id="i-check" /></span>Assinar no GOV.BR</li>
                <li className="sign__step">
                  <span className={`marker ${submittedOrComplete ? "marker--soft" : ""}`}>
                    {submittedOrComplete ? <Icon id="i-check" /> : "3"}
                  </span>
                  Enviar assinado
                </li>
              </ol>

              {contract.status === "EM_ANDAMENTO" && generatedFile && !submittedOrComplete ? (
                <>
                  <label
                    className={`dropzone${dragging ? " is-over" : ""}`}
                    hidden={Boolean(file)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      chooseFile(event.dataTransfer.files[0]);
                    }}
                  >
                    <input
                      ref={inputRef}
                      className="sr-only"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => chooseFile(event.target.files?.[0])}
                    />
                    <Icon id="i-upload" />
                    <span className="dropzone__title">Enviar contrato assinado</span>
                    <span className="dropzone__hint">PDF de até 10 MB</span>
                    <span className="dropzone__error" role="alert">{error}</span>
                  </label>
                  {file ? (
                    <div className="upload-ready is-visible">
                      <p className="upload-ready__name">{file.name} ({(file.size / 1048576).toFixed(1).replace(".", ",")} MB)</p>
                      <div className="upload-ready__actions">
                        <button className="btn btn--secondary btn--sm" type="button" onClick={resetFile}>Trocar arquivo</button>
                        <button className="btn btn--primary btn--sm" type="button" disabled={busy} onClick={() => void sendFile()}>
                          {busy ? "Enviando..." : "Enviar contrato"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {error && file ? <p className="dropzone__error" role="alert">{error}</p> : null}
                </>
              ) : null}

              {submittedOrComplete ? (
                <p className="upload-ready is-visible">
                  Contrato enviado. Vamos conferir sua assinatura e avisar quando o repertório for liberado.
                </p>
              ) : null}
            </section>
            <Summary />
          </div>
        </>
      ) : null}
    </>
  );
}
