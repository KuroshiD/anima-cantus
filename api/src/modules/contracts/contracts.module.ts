import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { createZodDto } from "nestjs-zod";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import type { Request } from "express";
import {
  asDate,
  contractDraftSchema,
  formatBRL,
  formatDateBR,
  isoDate,
  sumPrices,
  uploadConfirmSchema,
  uploadIntentSchema,
  valorPorExtenso,
  type ContractDraftInput,
} from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { StorageService } from "../../storage.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { requireCoupleId, type AuthUser } from "../../security";
import { anniversaryIso, repertoireWindow } from "@anima/shared";
import type { Prisma } from "@prisma/client";

class DraftDto extends createZodDto(contractDraftSchema) {}
class UploadIntentDto extends createZodDto(uploadIntentSchema) {}
class UploadConfirmDto extends createZodDto(uploadConfirmSchema) {}

type AuthRequest = Request & { user?: AuthUser };

@ApiTags("contratos")
@Controller("contratos")
@UseGuards(SessionGuard)
class ContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue("contracts") private readonly contractsQueue: Queue,
    @InjectQueue("uploads") private readonly uploadsQueue: Queue,
  ) {}

  @Get("me")
  async mine(@Req() req: AuthRequest) {
    return this.present(requireCoupleId(req));
  }

  @Get("me/previa")
  async preview(@Req() req: AuthRequest) {
    const contract = await this.load(requireCoupleId(req));
    const priced = await this.price(contract.items.map((item) => item.serviceId), contract.discountCents);
    return priced;
  }

  @Put("me/rascunho")
  async save(@Req() req: AuthRequest, @Body() body: DraftDto) {
    const id = requireCoupleId(req);
    const contract = await this.load(id);
    if (contract.status !== "EM_ANDAMENTO") {
      throw new ConflictException("O contrato não pode ser alterado neste status.");
    }
    await this.ensureServices(body.serviceIds);
    const window = repertoireWindow(body.weddingDate);
    await this.prisma.$transaction(async (tx) => {
      await tx.couple.update({
        where: { id },
        data: {
          legalName: body.legalName,
          documentId: body.documentId,
          address: body.address,
          email: body.email,
          phone: body.phone,
          weddingDate: asDate(body.weddingDate),
          weddingTime: body.weddingTime,
          venue: body.venue,
          formation: body.formation || null,
          paymentTerms: body.paymentTerms,
        },
      });
      await tx.journey.update({
        where: { coupleId: id },
        data: {
          repertoireWindowStart: asDate(window.start),
          repertoireWindowEnd: asDate(window.end),
          anniversarySendOn: asDate(anniversaryIso(body.weddingDate)),
        },
      });
      await tx.contractItem.deleteMany({ where: { contractId: contract.id } });
      await tx.contractItem.createMany({
        data: body.serviceIds.map((serviceId) => ({ contractId: contract.id, serviceId })),
      });
    });
    return this.present(id);
  }

  @Post("me/gerar")
  async generate(@Req() req: AuthRequest) {
    const id = requireCoupleId(req);
    const contract = await this.load(id);
    if (contract.status !== "EM_ANDAMENTO") throw new ConflictException("O contrato não pode ser gerado neste status.");
    const couple = contract.couple;
    if (!couple.legalName || !couple.documentId || !couple.address || !couple.email || !couple.phone || !couple.venue || !couple.paymentTerms || !couple.weddingTime) {
      throw new BadRequestException("Preencha os dados do contrato antes de gerar o PDF.");
    }
    if (!contract.items.length) throw new BadRequestException("Selecione ao menos um serviço.");
    const priced = await this.price(contract.items.map((item) => item.serviceId), contract.discountCents);
    const snapshot = await this.prisma.contractSnapshot.create({
      data: {
        contractId: contract.id,
        totalCents: priced.totalCents,
        discountCents: contract.discountCents,
        totalInWords: priced.totalInWords,
        paymentTerms: couple.paymentTerms,
        itemsJson: priced.items as unknown as Prisma.InputJsonValue,
        legalName: couple.legalName,
        documentId: couple.documentId,
        weddingDate: couple.weddingDate,
        weddingTime: couple.weddingTime,
        venue: couple.venue,
        formation: couple.formation,
        address: couple.address,
        email: couple.email,
        phone: couple.phone,
      },
    });
    await this.contractsQueue.add("generate", { contractId: contract.id, snapshotId: snapshot.id }, { jobId: `pdf-${snapshot.id}` });
    return { snapshotId: snapshot.id, message: "O PDF está sendo gerado." };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("me/upload-url")
  async uploadUrl(@Req() req: AuthRequest, @Body() body: UploadIntentDto) {
    const contract = await this.load(requireCoupleId(req));
    if (contract.status !== "EM_ANDAMENTO") throw new ConflictException("O envio não está disponível neste status.");
    if (!contract.snapshots.length) throw new BadRequestException("Gere o contrato antes de enviar o arquivo assinado.");
    if (!body.fileName.toLowerCase().endsWith(".pdf")) throw new BadRequestException("Envie um arquivo PDF.");
    const key = `contracts/${contract.id}/signed/${randomUUID()}.pdf`;
    const url = await this.storage.presignPut(key, body.sizeBytes);
    return { url, key, headers: { "Content-Type": "application/pdf" } };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("me/upload-confirmar")
  async confirm(@Req() req: AuthRequest, @Body() body: UploadConfirmDto) {
    const contract = await this.load(requireCoupleId(req));
    const prefix = `contracts/${contract.id}/signed/`;
    if (!body.key.startsWith(prefix) || body.key.includes("..")) throw new BadRequestException("Arquivo inválido.");
    const snapshot = contract.snapshots[0];
    if (!snapshot) throw new BadRequestException("Gere o contrato antes de enviar o arquivo assinado.");
    await this.uploadsQueue.add("process", { contractId: contract.id, snapshotId: snapshot.id, key: body.key }, { jobId: body.key });
    return { message: "Arquivo recebido. Vamos conferir o PDF e a assinatura." };
  }

  @Get("me/arquivos/:fileId/download")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'attachment; filename="contrato-anima-cantus.pdf"')
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Cache-Control", "no-store")
  async download(@Req() req: AuthRequest, @Param("fileId") fileId: string): Promise<StreamableFile> {
    const file = await this.prisma.contractFile.findFirst({
      where: { id: fileId, contract: { coupleId: requireCoupleId(req) } },
    });
    if (!file) throw new NotFoundException("Arquivo não encontrado.");
    const stored = await this.storage.read(file.objectKey);
    return new StreamableFile(stored.body);
  }

  private async load(id: string) {
    return this.prisma.contract.findUniqueOrThrow({
      where: { coupleId: id },
      include: {
        couple: true,
        items: true,
        snapshots: { orderBy: { createdAt: "desc" } },
        files: { orderBy: { createdAt: "desc" } },
        validations: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  private async ensureServices(ids: string[]) {
    const found = await this.prisma.serviceItem.findMany({ where: { id: { in: ids }, active: true } });
    if (found.length !== new Set(ids).size) throw new BadRequestException("Há um serviço indisponível na seleção.");
  }

  private async price(serviceIds: string[], discountCents: number) {
    const services = await this.prisma.serviceItem.findMany({ where: { id: { in: serviceIds }, active: true } });
    if (services.length !== serviceIds.length) throw new BadRequestException("Há um serviço indisponível na seleção.");
    const items = services
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((service) => ({
        serviceId: service.id,
        name: service.name,
        kind: service.kind,
        priceCents: service.priceCents,
        priceLabel: formatBRL(service.priceCents),
      }));
    const totalCents = sumPrices(items.map((item) => item.priceCents), discountCents);
    return { items, discountCents, totalCents, totalLabel: formatBRL(totalCents), totalInWords: valorPorExtenso(totalCents) };
  }

  private async present(id: string) {
    const contract = await this.load(id);
    const catalog = await this.prisma.serviceItem.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const latest = contract.snapshots[0] ?? null;
    return {
      id: contract.id,
      status: contract.status,
      uploadError: contract.uploadError,
      discountCents: contract.discountCents,
      serviceIds: contract.items.map((item) => item.serviceId),
      couple: {
        legalName: contract.couple.legalName ?? "",
        documentId: contract.couple.documentId ?? "",
        address: contract.couple.address ?? "",
        email: contract.couple.email ?? "",
        phone: contract.couple.phone ?? "",
        weddingDate: isoDate(contract.couple.weddingDate),
        weddingTime: contract.couple.weddingTime ?? "",
        venue: contract.couple.venue ?? "",
        formation: contract.couple.formation ?? "",
        paymentTerms: contract.couple.paymentTerms ?? "",
        partnerOne: contract.couple.partnerOne,
        partnerTwo: contract.couple.partnerTwo,
      },
      catalog,
      latest: latest
        ? {
            id: latest.id,
            totalCents: latest.totalCents,
            totalInWords: latest.totalInWords,
            totalLabel: formatBRL(latest.totalCents),
            paymentTerms: latest.paymentTerms,
            items: latest.itemsJson,
            createdAt: latest.createdAt,
          }
        : null,
      files: contract.files.map((file) => ({
        id: file.id,
        kind: file.kind,
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
      })),
      validations: contract.validations.map((row) => ({
        accepted: row.accepted,
        reason: row.reason,
        createdAt: row.createdAt,
      })),
      limitation: "O hash SHA-256 comprova a integridade do arquivo enviado, não a autenticidade da assinatura. A conferência é feita pela equipe no verificador do ITI.",
    };
  }
}

export type DraftShape = ContractDraftInput;

@Module({
  imports: [AuthModule],
  controllers: [ContractsController],
})
export class ContractsModule {}

export { formatDateBR };
