import type { Metadata } from "next";
import Link from "next/link";
import { PublicBudgetForm } from "../../components/public-budget-form";

export const metadata: Metadata = { title: "Pedir orçamento — Anima Cantus" };

export default function BudgetPage() {
  return (
    <>
      <header className="legal__bar">
        <Link className="legal__brand" href="/acesso" aria-label="Anima Cantus"><span>Anima</span><span>Cantus</span></Link>
        <Link className="btn btn--secondary btn--sm" href="/acesso">Área do casal</Link>
      </header>
      <main className="legal__main quote">
        <div className="container">
          <p className="eyebrow eyebrow--green">Orçamento</p>
          <h1 className="page-title">Peça um orçamento</h1>
          <p className="quote__intro">Conte um pouco sobre o casamento e a Anima Cantus retorna com uma proposta para a música da cerimônia de vocês.</p>
          <div className="split">
            <PublicBudgetForm />
            <aside className="card quote__how" aria-labelledby="how-title">
              <h2 className="heading-serif heading-serif--md" id="how-title">Como funciona</h2>
              <ol className="steps">
                <li><span className="marker marker--soft">1</span><div><p className="steps__title">Vocês enviam o pedido</p><p className="steps__desc">Com a data, o local e o que procuram.</p></div></li>
                <li><span className="marker marker--soft">2</span><div><p className="steps__title">Recebem a proposta</p><p className="steps__desc">A equipe retorna pelos dados de contato informados.</p></div></li>
                <li><span className="marker marker--soft">3</span><div><p className="steps__title">Segue a contratação</p><p className="steps__desc">Depois, vocês acessam a área do casal e acompanham a jornada.</p></div></li>
              </ol>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
