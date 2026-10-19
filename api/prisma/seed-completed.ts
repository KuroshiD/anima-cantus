import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { LEGAL_VERSION, anniversaryIso, formatBRL, repertoireWindow, valorPorExtenso } from "@anima/shared";

const databaseUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

const email = "casal.concluido@animacantus.local";
const password = "CasalCompleto@12345";
const coupleId = "8b652662-3178-43df-8f34-b588739e3056";
const weddingDate = "2024-11-20";
const anniversaryDate = anniversaryIso(weddingDate);
const songs = ["Canon in D", "Ave Maria", "Perfect", "Clair de Lune", "River Flows in You", "Marry You"];

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.$transaction(async (tx) => {
    const [admin, service, moments] = await Promise.all([
      tx.user.findFirst({ where: { role: "ADMIN" } }),
      tx.serviceItem.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      tx.ceremonyMoment.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    if (!admin) throw new Error("Execute primeiro o seed principal: falta uma conta de equipe.");
    if (!service) throw new Error("Execute primeiro o seed principal: falta um serviço ativo.");
    if (moments.length === 0) throw new Error("Execute primeiro o seed principal: faltam momentos da cerimônia.");

    const coupleData = {
      partnerOne: "Camila",
      partnerTwo: "Lucas",
      email,
      phone: "16999990001",
      legalName: "Camila e Lucas",
      documentId: "52998224725",
      address: "Rua de Teste, 100, Ribeirão Preto",
      weddingDate: new Date(`${weddingDate}T00:00:00.000Z`),
      weddingTime: "16:00",
      venue: "Capela",
      formation: "Voz, piano e violino",
      paymentTerms: "50% na assinatura e 50% até a cerimônia",
    };
    await tx.couple.upsert({
      where: { id: coupleId },
      create: { id: coupleId, ...coupleData },
      update: coupleData,
    });

    await tx.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        role: "COUPLE",
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: LEGAL_VERSION,
        coupleId,
      },
      update: {
        passwordHash,
        role: "COUPLE",
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: LEGAL_VERSION,
        coupleId,
      },
    });

    const window = repertoireWindow(weddingDate);
    const journey = await tx.journey.upsert({
      where: { coupleId },
      create: {
        coupleId,
        repertoireWindowStart: new Date(`${window.start}T00:00:00.000Z`),
        repertoireWindowEnd: new Date(`${window.end}T00:00:00.000Z`),
        anniversarySendOn: new Date(`${anniversaryDate}T00:00:00.000Z`),
      },
      update: {
        repertoireWindowStart: new Date(`${window.start}T00:00:00.000Z`),
        repertoireWindowEnd: new Date(`${window.end}T00:00:00.000Z`),
        anniversarySendOn: new Date(`${anniversaryDate}T00:00:00.000Z`),
      },
    });
    for (const step of ["CADASTRO", "CONTRATO", "REPERTORIO", "CASAMENTO", "POS_EVENTO"] as const) {
      await tx.journeyStep.upsert({
        where: { journeyId_step: { journeyId: journey.id, step } },
        create: { journeyId: journey.id, step, status: "CONCLUIDA" },
        update: { status: "CONCLUIDA" },
      });
    }

    const total = service.priceCents;
    const contract = await tx.contract.upsert({
      where: { coupleId },
      create: { coupleId, status: "CONCLUIDA", items: { create: { serviceId: service.id } } },
      update: { status: "CONCLUIDA" },
    });
    await tx.contractItem.upsert({
      where: { contractId_serviceId: { contractId: contract.id, serviceId: service.id } },
      create: { contractId: contract.id, serviceId: service.id },
      update: {},
    });

    const snapshot = {
      contractId: contract.id,
      totalCents: total,
      discountCents: 0,
      totalInWords: valorPorExtenso(total),
      paymentTerms: coupleData.paymentTerms,
      itemsJson: [{
        serviceId: service.id,
        name: service.name,
        kind: service.kind,
        priceCents: total,
        priceLabel: formatBRL(total),
      }],
      legalName: coupleData.legalName,
      documentId: coupleData.documentId,
      weddingDate: coupleData.weddingDate,
      weddingTime: coupleData.weddingTime,
      venue: coupleData.venue,
      formation: coupleData.formation,
      address: coupleData.address,
      email,
      phone: coupleData.phone,
    };
    const existingSnapshot = await tx.contractSnapshot.findFirst({ where: { contractId: contract.id } });
    if (!existingSnapshot) {
      await tx.contractSnapshot.create({ data: snapshot });
    }

    const validation = await tx.contractValidation.findFirst({ where: { contractId: contract.id } });
    const validationData = { accepted: true, reason: null, adminUserId: admin.id };
    if (!validation) {
      await tx.contractValidation.create({ data: { contractId: contract.id, ...validationData } });
    }

    const selections = await Promise.all(moments.map((moment, index) => tx.repertoireSelection.upsert({
      where: { coupleId_momentId: { coupleId, momentId: moment.id } },
      create: { coupleId, momentId: moment.id, songTitle: songs[index % songs.length] },
      update: { songTitle: songs[index % songs.length] },
    })));
    if (selections.length !== moments.length) throw new Error("Não foi possível preencher todas as músicas.");

    const anniversaryLog = await tx.notificationLog.findFirst({
      where: {
        type: "ANNIVERSARY",
        entityType: "couple",
        entityId: coupleId,
        channel: "EMAIL",
        reference: `anniversary:${anniversaryDate}`,
      },
    });
    const anniversaryData = { status: "ENVIADO" as const, detail: null };
    if (!anniversaryLog) {
      await tx.notificationLog.create({
        data: {
          type: "ANNIVERSARY",
          entityType: "couple",
          entityId: coupleId,
          channel: "EMAIL",
          reference: `anniversary:${anniversaryDate}`,
          ...anniversaryData,
        },
      });
    }
  }, { timeout: 15_000 });

  console.log(`Seed de jornada concluída aplicada para ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
