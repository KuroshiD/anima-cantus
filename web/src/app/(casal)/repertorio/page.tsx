import type { Metadata } from "next";
import { PageHeading } from "../../../components/shell";
import { RepertoireBoard } from "../../../components/repertoire-board";
import { serverApi } from "../../../lib/server-api";
import type { RepertoireView } from "../../../lib/types";

export const metadata: Metadata = {
  title: "Repertório — Anima Cantus",
};

export default async function RepertoirePage() {
  const result = await serverApi<RepertoireView>("/repertorio");
  if (!result.data) {
    return (
      <section className="card">
        <h1 className="heading-serif heading-serif--md">Não foi possível carregar o repertório</h1>
        <p className="text-muted text-sm">Tente novamente em alguns instantes.</p>
      </section>
    );
  }
  return (
    <>
      <PageHeading eyebrow="Etapa 3 de 5" title="Nosso repertório" />
      <RepertoireBoard initial={result.data} />
    </>
  );
}
