import Link from "next/link";
import { LEGAL_VERSION } from "@anima/shared";

type LegalPageKind = "terms" | "privacy";

const content = {
  terms: {
    title: "Termos de uso",
    linkedTitle: "Política de privacidade",
    linkedHref: "/privacidade",
    introduction: "Estes termos explicam como funciona a área do casal da Anima Cantus. Ao criar uma conta, vocês concordam com as regras abaixo.",
    sections: [
      { heading: "1. A área do casal", paragraphs: ["É o espaço onde o casal acompanha a jornada com a Anima Cantus: preencher e assinar o contrato, escolher o repertório da cerimônia e acompanhar as etapas até o grande dia."] },
      { heading: "2. Cadastro e conta", paragraphs: ["Para criar a conta, é preciso informar dados verdadeiros e confirmar o e-mail. Cada conta é do casal, e a senha é pessoal: guardem-na com cuidado e avisem se suspeitarem de uso indevido."] },
      { heading: "3. Contrato e valores", paragraphs: ["O contrato é gerado a partir dos dados e dos serviços escolhidos, e assinado digitalmente pelo GOV.BR. Os valores de um contrato gerado ficam preservados, mesmo após futuras alterações de preço."] },
      { heading: "4. Repertório", paragraphs: ["As músicas escolhidas podem ser alteradas dentro do prazo indicado na própria área do casal. Depois do prazo, mudanças dependem de combinação com a equipe."] },
      { heading: "5. Uso adequado", bullets: ["Não compartilhem o acesso com terceiros.", "Não tentem acessar dados de outros casais.", "Não usem a plataforma para fins diferentes dos previstos."] },
      { heading: "6. Alterações destes termos", paragraphs: ["Se os termos mudarem, a nova versão será publicada aqui e, quando necessário, será pedido um novo aceite."] },
      { heading: "7. Contato", paragraphs: ["Dúvidas sobre estes termos podem ser enviadas pelos canais de contato da Anima Cantus."] },
    ],
  },
  privacy: {
    title: "Política de privacidade",
    linkedTitle: "Termos de uso",
    linkedHref: "/termos",
    introduction: "Esta política explica quais dados pessoais a Anima Cantus coleta na área do casal, para que usa e quais são os direitos de vocês, conforme a Lei Geral de Proteção de Dados (LGPD).",
    sections: [
      { heading: "1. Dados que coletamos", bullets: ["Dados de cadastro: nomes, e-mail e senha (armazenada de forma protegida).", "Dados do contrato: nome completo, CPF, telefone, data, horário e local da cerimônia.", "Escolhas de repertório e andamento das etapas.", "Registro do aceite dos termos (versão, data e hora)."] },
      { heading: "2. Para que usamos", bullets: ["Criar e manter a conta do casal.", "Gerar o contrato e acompanhar a assinatura.", "Organizar a música da cerimônia e a comunicação com vocês.", "Cumprir obrigações legais."] },
      { heading: "3. Compartilhamento", paragraphs: ["Os dados são usados apenas pela equipe da Anima Cantus e por serviços necessários ao funcionamento da plataforma, como envio de e-mails. Não vendemos dados pessoais."] },
      { heading: "4. Por quanto tempo guardamos", paragraphs: ["Mantemos os dados enquanto a conta existir e pelo período necessário para cumprir obrigações legais e contratuais."] },
      { heading: "5. Direitos de vocês", paragraphs: ["Vocês podem solicitar a confirmação de que tratamos seus dados, o acesso, a correção, a anonimização ou eliminação quando cabível, a portabilidade e a revogação do consentimento."] },
      { heading: "6. Segurança", paragraphs: ["Adotamos medidas técnicas e organizacionais para proteger os dados contra acessos não autorizados."] },
      { heading: "7. Contato", paragraphs: ["Para exercer seus direitos ou tirar dúvidas, fale conosco pelos canais de contato da Anima Cantus."] },
    ],
  },
} satisfies Record<LegalPageKind, {
  title: string;
  linkedTitle: string;
  linkedHref: string;
  introduction: string;
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
}>;

export function LegalDocument({ kind }: { kind: LegalPageKind }) {
  const page = content[kind];
  const version = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_VERSION}T00:00:00Z`));

  return (
    <>
      <header className="legal__bar">
        <Link className="legal__brand" href="/acesso" aria-label="Anima Cantus"><span>Anima</span><span>Cantus</span></Link>
        <Link className="btn btn--secondary btn--sm" href="/acesso">Voltar</Link>
      </header>
      <main className="legal__main">
        <article className="legal__doc">
          <p className="eyebrow eyebrow--green">Área do casal</p>
          <h1 className="page-title">{page.title}</h1>
          <p className="legal__meta">
            Versão de {version} · <Link className="link" href={page.linkedHref}>{page.linkedTitle}</Link>
          </p>
          <p style={{ marginTop: "1.5rem" }}>{page.introduction}</p>
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          ))}
        </article>
      </main>
    </>
  );
}
