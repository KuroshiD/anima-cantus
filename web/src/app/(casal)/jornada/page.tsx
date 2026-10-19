import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "../../../components/icons";
import { PageHeading } from "../../../components/shell";
import { serverApi } from "../../../lib/server-api";
import type { JourneyView } from "../../../lib/types";

export const metadata: Metadata = {
  title: "Minha jornada — Anima Cantus",
};

export default async function JourneyPage() {
  const result = await serverApi<JourneyView>("/jornada");
  const journey = result.data;
  if (!journey?.coupleName) {
    return (
      <section className="card">
        <h1 className="heading-serif heading-serif--md">Não foi possível carregar a jornada</h1>
        <p className="text-muted text-sm">Tente novamente em alguns instantes.</p>
      </section>
    );
  }
  const unit = journey.daysRemaining === 1 ? "dia" : "dias";
  return (
    <>
      <PageHeading eyebrow="Área do casal" title={`Olá, ${journey.coupleName}`} />
      <section className="split split--stretch" aria-label="Resumo">
        <article className="card next-step">
          <p className="next-step__label">Sua próxima etapa</p>
          <h2 className="heading-serif next-step__title">{journey.next?.title ?? "Jornada concluída"}</h2>
          <p className="next-step__desc">{journey.next?.description ?? "Todas as etapas foram concluídas."}</p>
          {journey.next ? (
            <div className="next-step__action">
              <Link className="btn btn--primary" href={journey.next.href}>Continuar <Icon id="i-arrow-right" /></Link>
            </div>
          ) : null}
          <div className="next-step__progress">
            <div className="progress" role="progressbar" aria-valuenow={journey.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da jornada">
              <span className="progress__fill" style={{ ["--value" as string]: `${journey.progress.percent}%` }} />
            </div>
            <div className="next-step__progress-meta">
              <span>{journey.progress.completed} de {journey.progress.total} etapas</span>
              <span>{journey.progress.percent}% concluído</span>
            </div>
          </div>
        </article>
        <aside className="card card--green countdown" aria-label="Contagem regressiva">
          <Icon id="i-calendar" />
          <p className="countdown__label">Faltam</p>
          <p className="countdown__number"><span>{journey.daysRemaining}</span> <span>{unit}</span></p>
          <p className="countdown__caption">para o grande dia</p>
        </aside>
      </section>
      <section className="journey" aria-labelledby="journey-title">
        <div className="journey__header">
          <div>
            <p className="eyebrow">Progresso</p>
            <h2 className="section-title" id="journey-title">Sua jornada</h2>
          </div>
          <p className="text-xs text-muted">{journey.updatedLabel}</p>
        </div>
        <ol className="journey__list">
          {journey.steps.map((step, index) => (
            <li className="journey__item" key={step.key}>
              <span className={`marker ${step.status === "CONCLUIDA" ? "marker--done" : step.status === "EM_ANDAMENTO" || step.status === "AGUARDANDO_VALIDACAO" ? "marker--current" : ""}`}>
                {step.status === "CONCLUIDA" ? <Icon id="i-check" /> : step.status === "EM_ANDAMENTO" || step.status === "AGUARDANDO_VALIDACAO" ? <Icon id="i-clock" /> : index + 1}
              </span>
              <div className="journey__text">
                <p className="journey__name">{step.name}</p>
                <p className="journey__desc">{step.description}</p>
              </div>
              <span className={`pill ${step.status === "CONCLUIDA" ? "pill--done" : step.status === "PENDENTE" ? "pill--pending" : "pill--progress"}`}>{step.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
