import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { anniversaryIso, formatBRL, repertoireWindow, sumPrices, valorPorExtenso } from "@anima/shared";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: "admin@animacantus.local" } });
  if (existing) {
    console.log("Seed já aplicado.");
    return;
  }

  const password = await argon2.hash("Casal@12345", { type: argon2.argon2id });
  const adminPassword = await argon2.hash("Admin@12345", { type: argon2.argon2id });

  const services = await Promise.all([
    prisma.serviceItem.create({ data: { name: "Pacote completo", description: "Cerimônia com a formação principal", kind: "PACOTE", priceCents: 350_000, sortOrder: 1 } }),
    prisma.serviceItem.create({ data: { name: "Instrumentista adicional", description: "Um músico a mais na formação", kind: "ADICIONAL", priceCents: 40_000, sortOrder: 2 } }),
    prisma.serviceItem.create({ data: { name: "Recepção", description: "Música na recepção", kind: "ADICIONAL", priceCents: 80_000, sortOrder: 3 } }),
  ]);

  const momentNames = ["Entrada dos padrinhos", "Entrada do noivo", "Entrada da noiva", "Alianças", "Assinaturas", "Saída dos noivos"];
  const moments = [];
  for (const [index, name] of momentNames.entries()) {
    moments.push(await prisma.ceremonyMoment.create({ data: { name, sortOrder: index + 1 } }));
  }

  const tips: { moment: string; title: string; artist: string }[] = [
    { moment: "Entrada dos padrinhos", title: "A Thousand Years", artist: "The Piano Guys" },
    { moment: "Entrada do noivo", title: "Ave Maria", artist: "Schubert" },
    { moment: "Entrada da noiva", title: "Perfect", artist: "Ed Sheeran" },
    { moment: "Alianças", title: "Canon in D", artist: "Pachelbel" },
    { moment: "Assinaturas", title: "River Flows in You", artist: "Yiruma" },
    { moment: "Saída dos noivos", title: "Marry You", artist: "Bruno Mars" },
  ];
  for (const tip of tips) {
    const moment = moments.find((item) => item.name === tip.moment);
    await prisma.musicTip.create({ data: { momentId: moment?.id, title: tip.title, artist: tip.artist, note: "Sugestão para a cerimônia" } });
  }

  await prisma.alertConfig.create({ data: { id: "default", reminderLeadDays: 7 } });
  await prisma.siteContent.createMany({
    data: [
      { key: "hero_title", value: "Música para o dia em que a história de vocês ganha plateia" },
      { key: "hero_text", value: "O Anima Cantus acompanha casamentos com um repertório ao vivo, do primeiro olhar até a saída dos noivos. Peça um orçamento ou entre na área do casal para seguir a contratação." },
      { key: "about", value: "Somos um grupo de câmara formado para cerimônias. A formação reúne voz, piano, violino e violão, e se adapta ao rito e ao espaço. Cada apresentação é montada com o casal, sem playlist genérica." },
      { key: "instagram_url", value: "https://instagram.com" },
    ],
  });
  await prisma.galleryItem.createMany({
    data: [
      { title: "Cerimônia ao ar livre", mediaUrl: "/gallery/cerimonia.svg", kind: "foto", altText: "Formação do grupo durante uma cerimônia ao ar livre", sortOrder: 1 },
      { title: "Entrada da noiva", mediaUrl: "/gallery/entrada.svg", kind: "foto", altText: "Músicos posicionados no altar durante a entrada", sortOrder: 2 },
      { title: "Recepção", mediaUrl: "/gallery/recepcao.svg", kind: "video", altText: "Trecho de música na recepção dos convidados", sortOrder: 3 },
    ],
  });

  await prisma.user.create({
    data: { email: "admin@animacantus.local", passwordHash: adminPassword, role: "ADMIN", emailVerifiedAt: new Date() },
  });

  const window = repertoireWindow("2026-11-20");
  const marina = await prisma.couple.create({
    data: {
      partnerOne: "Marina",
      partnerTwo: "Rafael",
      email: "marina.rafael@animacantus.local",
      phone: "16999990000",
      legalName: "Marina e Rafael",
      documentId: "12345678909",
      address: "Rua das Flores, 100, Ribeirão Preto",
      weddingDate: new Date("2026-11-20T00:00:00.000Z"),
      weddingTime: "16:00",
      venue: "Capela",
      formation: "Voz, piano e violino",
      paymentTerms: "50% na assinatura e 50% até a cerimônia",
    },
  });
  await prisma.user.create({
    data: {
      email: "marina.rafael@animacantus.local",
      passwordHash: password,
      role: "COUPLE",
      emailVerifiedAt: new Date(),
      coupleId: marina.id,
    },
  });
  await prisma.journey.create({
    data: {
      coupleId: marina.id,
      repertoireWindowStart: new Date(`${window.start}T00:00:00.000Z`),
      repertoireWindowEnd: new Date(`${window.end}T00:00:00.000Z`),
      anniversarySendOn: new Date(`${anniversaryIso("2026-11-20")}T00:00:00.000Z`),
      steps: {
        create: [
          { step: "CADASTRO", status: "CONCLUIDA" },
          { step: "CONTRATO", status: "EM_ANDAMENTO" },
          { step: "REPERTORIO", status: "PENDENTE" },
          { step: "CASAMENTO", status: "PENDENTE" },
          { step: "POS_EVENTO", status: "PENDENTE" },
        ],
      },
    },
  });
  const total = sumPrices(services.map((service) => service.priceCents));
  const contract = await prisma.contract.create({
    data: {
      coupleId: marina.id,
      status: "EM_ANDAMENTO",
      items: { create: services.map((service) => ({ serviceId: service.id })) },
    },
  });
  await prisma.contractSnapshot.create({
    data: {
      contractId: contract.id,
      totalCents: total,
      discountCents: 0,
      totalInWords: valorPorExtenso(total),
      paymentTerms: "50% na assinatura e 50% até a cerimônia",
      itemsJson: services.map((service) => ({
        serviceId: service.id,
        name: service.name,
        kind: service.kind,
        priceCents: service.priceCents,
        priceLabel: formatBRL(service.priceCents),
      })),
      legalName: "Marina e Rafael",
      documentId: "12345678909",
      weddingDate: new Date("2026-11-20T00:00:00.000Z"),
      weddingTime: "16:00",
      venue: "Capela",
      formation: "Voz, piano e violino",
      address: "Rua das Flores, 100, Ribeirão Preto",
      email: "marina.rafael@animacantus.local",
      phone: "16999990000",
    },
  });
  const chosen = ["Marcha Nupcial", "Ave Maria", "Perfect", "", "", ""];
  for (const [index, moment] of moments.entries()) {
    if (!chosen[index]) continue;
    await prisma.repertoireSelection.create({ data: { coupleId: marina.id, momentId: moment.id, songTitle: chosen[index] } });
  }

  const demoWindow = repertoireWindow("2026-10-25");
  const demo = await prisma.couple.create({
    data: {
      partnerOne: "Exemplo",
      partnerTwo: "Demonstração",
      email: "exemplo@animacantus.local",
      phone: "16988880000",
      legalName: "Exemplo e Demonstração",
      documentId: "52998224725",
      address: "Avenida Central, 20",
      weddingDate: new Date("2026-10-25T00:00:00.000Z"),
      weddingTime: "19:00",
      venue: "Salão jardim",
      paymentTerms: "À vista",
    },
  });
  await prisma.user.create({
    data: { email: "exemplo@animacantus.local", passwordHash: password, role: "COUPLE", emailVerifiedAt: new Date(), coupleId: demo.id },
  });
  await prisma.journey.create({
    data: {
      coupleId: demo.id,
      repertoireWindowStart: new Date(`${demoWindow.start}T00:00:00.000Z`),
      repertoireWindowEnd: new Date(`${demoWindow.end}T00:00:00.000Z`),
      anniversarySendOn: new Date(`${anniversaryIso("2026-10-25")}T00:00:00.000Z`),
      steps: {
        create: [
          { step: "CADASTRO", status: "CONCLUIDA" },
          { step: "CONTRATO", status: "CONCLUIDA" },
          { step: "REPERTORIO", status: "EM_ANDAMENTO" },
          { step: "CASAMENTO", status: "PENDENTE" },
          { step: "POS_EVENTO", status: "PENDENTE" },
        ],
      },
    },
  });
  const demoTotal = services[0].priceCents;
  const demoContract = await prisma.contract.create({
    data: { coupleId: demo.id, status: "CONCLUIDA", items: { create: [{ serviceId: services[0].id }] } },
  });
  await prisma.contractSnapshot.create({
    data: {
      contractId: demoContract.id,
      totalCents: demoTotal,
      discountCents: 0,
      totalInWords: valorPorExtenso(demoTotal),
      paymentTerms: "À vista",
      itemsJson: [{ serviceId: services[0].id, name: services[0].name, kind: services[0].kind, priceCents: demoTotal, priceLabel: formatBRL(demoTotal) }],
      legalName: "Exemplo e Demonstração",
      documentId: "52998224725",
      weddingDate: new Date("2026-10-25T00:00:00.000Z"),
      weddingTime: "19:00",
      venue: "Salão jardim",
      address: "Avenida Central, 20",
      email: "exemplo@animacantus.local",
      phone: "16988880000",
    },
  });
  await prisma.repertoireSelection.create({ data: { coupleId: demo.id, momentId: moments[0].id, songTitle: "Canon in D" } });
  await prisma.repertoireSelection.create({ data: { coupleId: demo.id, momentId: moments[2].id, songTitle: "Perfect" } });

  console.log("Seed concluído. Casal: marina.rafael@animacantus.local / Casal@12345. Admin: admin@animacantus.local / Admin@12345.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
