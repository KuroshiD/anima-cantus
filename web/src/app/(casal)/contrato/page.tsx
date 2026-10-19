import type { Metadata } from "next";
import { PageHeading } from "../../../components/shell";
import { ContractWizard } from "../../../components/contract-wizard";
import { serverApi } from "../../../lib/server-api";
import type { ContractView } from "../../../lib/types";

export const metadata: Metadata = {
  title: "Contrato — Anima Cantus",
};

export default async function ContractPage() {
  const result = await serverApi<ContractView>("/contratos/me");
  if (!result.data) {
    return (
      <section className="card">
        <h1 className="heading-serif heading-serif--md">Não foi possível carregar o contrato</h1>
        <p className="text-muted text-sm">Tente novamente em alguns instantes.</p>
      </section>
    );
  }
  return (
    <>
      <PageHeading eyebrow="Etapa 2 de 5" title="Contrato" />
      <ContractWizard initial={result.data} />
    </>
  );
}
