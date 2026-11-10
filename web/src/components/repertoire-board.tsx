"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { apiSend, readError } from "../lib/client-api";
import type { RepertoireView } from "../lib/types";

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const momentGuidance: Record<string, { tips: string[]; secret: string }> = {
  "Entrada dos padrinhos": {
    tips: [
      "Músicas acolhedoras e alegres criam uma atmosfera de amizade e celebração.",
      "Uma versão instrumental de uma canção conhecida é uma ótima alternativa.",
      "Considere o número de casais e o tempo necessário para a entrada completa.",
    ],
    secret: "A trilha deve acolher os padrinhos e preparar o clima da cerimônia.",
  },
  "Entrada do noivo": {
    tips: [
      "Escolha uma música que represente a personalidade dele: emocionante, alegre, marcante ou descontraída.",
      "Pode ser uma canção importante na vida dele ou na relação com quem o acompanhará.",
      "Uma versão instrumental de uma música favorita também funciona muito bem.",
    ],
    secret: "Ele deve se reconhecer na música e se sentir à vontade para viver a própria entrada.",
  },
  "Entrada da noiva": {
    tips: [
      "A Marcha Nupcial é uma opção, não uma obrigação: a música pode ser tradicional ou surpreendente.",
      "Escolha uma canção que desperte emoção e represente a noiva ou a história do casal.",
      "Combine com os músicos o início da caminhada, a abertura das portas e o tempo do percurso.",
    ],
    secret: "Ao imaginar a entrada, a noiva deve sentir que aquela música traduz o momento.",
  },
  Alianças: {
    tips: [
      "Canções sobre amor, compromisso e união reforçam o simbolismo da troca das alianças.",
      "A música também pode homenagear quem levará as alianças até o altar.",
      "Prefira uma duração adequada e um arranjo que não se sobreponha à cerimônia.",
    ],
    secret: "Dê espaço para a delicadeza e para o significado do compromisso.",
  },
  Assinaturas: {
    tips: [
      "Uma música suave ou instrumental acompanha o momento sem roubar a atenção.",
      "Aproveite para incluir uma canção querida que não apareceu em outras entradas.",
      "Como a duração pode variar, combine um arranjo que possa ser estendido ou finalizado naturalmente.",
    ],
    secret: "Mantenha uma atmosfera agradável durante esse momento mais protocolar.",
  },
  "Saída dos noivos": {
    tips: [
      "É o momento de celebrar: músicas vibrantes e refrões marcantes funcionam muito bem.",
      "Escolha algo que faça o casal sorrir e tenha a energia que deseja levar para a festa.",
      "Combine com os músicos a entrada do refrão ou o crescimento da música no início da saída.",
    ],
    secret: "A saída deve soar como a celebração da história que acaba de ganhar um novo capítulo.",
  },
};

const defaultGuidance = {
  tips: [
    "Escolha uma canção que tenha significado para vocês e combine com o clima deste momento.",
    "Conversem com os músicos sobre a duração, o arranjo e as transições.",
  ],
  secret: "A música deve refletir a história e o jeito de vocês.",
};

export function RepertoireBoard({ initial }: { initial: RepertoireView }) {
  const router = useRouter();
  const [moments, setMoments] = useState(initial.moments);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pickerRef = useRef<HTMLDialogElement>(null);
  const isCompleted = initial.status === "CONCLUIDA";
  const chosen = moments.filter((moment) => moment.song.trim()).length;
  const percent = Math.round((chosen / moments.length) * 100);
  const visible = useMemo(
    () => moments.filter((moment) => !query || normalize(`${moment.name} ${moment.song}`).includes(normalize(query))),
    [moments, query],
  );
  const current = moments.find((moment) => moment.id === editing);
  const guidance = current ? momentGuidance[current.name] ?? defaultGuidance : defaultGuidance;

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (editing && !picker.open) picker.showModal();
    if (!editing && picker.open) picker.close();
  }, [editing]);

  async function persist(next = moments) {
    if (isCompleted) return;
    setError("");
    setMessage("");
    const response = await apiSend("/repertorio", {
      method: "PUT",
      body: JSON.stringify({ selections: next.map((moment) => ({ momentId: moment.id, songTitle: moment.song })) }),
    });
    if (!response.ok) return setError(await readError(response));
    if (next.length > 0 && next.every((moment) => moment.song.trim())) {
      const completion = await apiSend("/repertorio/concluir", { method: "POST" });
      if (!completion.ok) return setError(await readError(completion));
      setMessage("Repertório concluído");
      router.refresh();
      return;
    }
    setMessage("Progresso salvo");
    router.refresh();
  }

  if (initial.locked) {
    return (
      <section className="card">
        <h2 className="heading-serif heading-serif--md">O repertório abre depois do contrato</h2>
        <p className="sign__desc">A etapa é liberada quando a equipe valida o documento assinado.</p>
        <Link className="btn btn--primary" href="/contrato">Ir para o contrato</Link>
      </section>
    );
  }

  return (
    <>
      <div className="deadline" role="note">
        <Icon id="i-clock" />
        <div className="deadline__text">
          <p className="deadline__title">{isCompleted ? "Repertório concluído" : `Complete até ${initial.window.endLabel}`}</p>
          <p className="deadline__sub">
            {isCompleted ? "Todas as músicas da cerimônia foram definidas." : `Janela recomendada: ${initial.window.startLabel} a ${initial.window.endLabel}`}
          </p>
        </div>
        <p className="deadline__count">{chosen} de {moments.length} escolhidas</p>
      </div>
      <div className="split">
        <section aria-labelledby="moments-title">
          <div className="moments__header">
            <div>
              <p className="eyebrow">Cerimônia</p>
              <h2 className="section-title" id="moments-title">Momentos musicais</h2>
            </div>
            <label className="search">
              <span className="sr-only">Buscar música</span>
              <Icon id="i-search" />
              <input type="search" value={query} placeholder="Buscar música" onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <ul className="moments">
            {visible.length === 0 ? <li className="moments__empty">Nenhuma música encontrada para essa busca.</li> : null}
            {visible.map((moment) => {
              const index = moments.findIndex((item) => item.id === moment.id);
              return (
              <li className="moment" key={moment.id}>
                <span className={`marker ${moment.song ? "marker--soft" : ""}`}>{moment.song ? <Icon id="i-music" /> : index + 1}</span>
                <div className="moment__text">
                  <p className="moment__name">{moment.name}</p>
                  <p className="moment__song">{moment.song || "Nenhuma música escolhida"}</p>
                </div>
                {isCompleted ? null : moment.song ? (
                  <button className="moment__chevron" type="button" aria-label={`Alterar música: ${moment.name}`} onClick={() => { setEditing(moment.id); setDraft(moment.song); }}>
                    <Icon id="i-chevron" />
                  </button>
                ) : (
                  <button className="btn btn--secondary btn--sm" type="button" onClick={() => { setEditing(moment.id); setDraft(""); }}>
                    <Icon id="i-plus" />Escolher
                  </button>
                )}
              </li>
            );
            })}
          </ul>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {!isCompleted ? (
            <div className="moments__save">
              <button className="btn btn--secondary" type="button" onClick={() => void persist()}>{message || "Salvar progresso"}</button>
            </div>
          ) : null}
        </section>
        <div className="aside">
          <aside className="card card--green inspiration">
            <p className="eyebrow">Dica geral</p>
            <h2 className="heading-serif inspiration__title">A música precisa ter a cara do casal</h2>
            <p>
              Não existe música certa ou errada para uma cerimônia. Clássica, MPB, pop, rock, sertanejo,
              gospel ou trilha de filme: qualquer estilo funciona quando tem significado para os noivos.
            </p>
            <p>
              Vale observar as regras do local, conferir se a letra combina com o momento e planejar com os
              músicos a duração e as transições. As canções não precisam ser do mesmo estilo, mas podem
              formar uma sequência com começo, emoção e celebração.
            </p>
          </aside>
          <section className="card" aria-labelledby="overall-title">
            <div className="overall__head">
              <h2 className="overall__title" id="overall-title">Progresso</h2>
              <span className="overall__value">{percent}%</span>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-labelledby="overall-title">
              <span className="progress__fill" style={{ ["--value" as string]: `${percent}%` }} />
            </div>
            <p className="overall__note">{isCompleted ? "A etapa foi marcada como concluída na sua jornada." : "Suas escolhas são salvas e podem ser retomadas a qualquer momento."}</p>
          </section>
        </div>
      </div>
      <footer className="page-footer"><Icon id="i-heart" />A música acompanha cada etapa da história de vocês.</footer>
      <dialog
        className="picker"
        ref={pickerRef}
        aria-labelledby="picker-title"
        onCancel={() => setEditing(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setEditing(null);
        }}
      >
        {current && !isCompleted ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            const song = draft.trim();
            if (!song || !editing) return;
            const next = moments.map((moment) => moment.id === editing ? { ...moment, song } : moment);
            setMoments(next);
            setEditing(null);
            void persist(next);
          }}>
            <div className="picker__form">
              <h2 className="heading-serif picker__title" id="picker-title">Escolher música</h2>
              <label className="picker__label" htmlFor="picker-input">{current.name}</label>
              <input id="picker-input" value={draft} placeholder="Nome da música" required onChange={(event) => setDraft(event.target.value)} />
              {current.tips.length ? (
                <div className="picker__suggestions" aria-label="Sugestões de músicas">
                  {current.tips.map((tip) => (
                    <button className="btn btn--secondary btn--sm" key={tip.id} type="button" onClick={() => setDraft(tip.title)}>
                      {tip.title}{tip.artist ? ` — ${tip.artist}` : ""}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="picker__hint">Combine com os músicos a duração e o arranjo de cada momento.</p>
              <div className="picker__actions">
                <button className="btn btn--secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button>
                <button className="btn btn--primary" type="submit">Salvar escolha</button>
              </div>
            </div>
            <aside className="picker__guidance">
              <p className="eyebrow">Dicas para este momento</p>
              <h3 className="heading-serif picker__guidance-title">{current.name}</h3>
              <ul className="picker__tips">
                {guidance.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
              <div className="picker__secret">
                <strong>O segredo</strong>
                <p>{guidance.secret}</p>
              </div>
            </aside>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
