import { Body, Controller, Get, Module, Post, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { createZodDto } from "nestjs-zod";
import { budgetSchema, budgetWhatsAppText, whatsAppLink } from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { RedisService } from "../../redis.service";
import { NotificationsService } from "../../notifications.service";
import { asDate } from "../../dates.util";

class BudgetDto extends createZodDto(budgetSchema) {}

@ApiTags("publico")
@Controller()
class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get("conteudo")
  async content() {
    const [rows, tips, gallery] = await Promise.all([
      this.prisma.siteContent.findMany(),
      this.prisma.musicTip.findMany({ where: { active: true }, include: { moment: true }, orderBy: { title: "asc" } }),
      this.prisma.galleryItem.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    return {
      pages: Object.fromEntries(rows.map((row) => [row.key, row.value])),
      tips: tips.map((tip) => ({
        id: tip.id,
        title: tip.title,
        artist: tip.artist,
        note: tip.note,
        moment: tip.moment?.name ?? "Cerimônia",
      })),
      gallery,
      whatsAppPhone: process.env.WHATSAPP_PHONE ?? "",
      instagram: rows.find((row) => row.key === "instagram_url")?.value ?? "",
    };
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("orcamentos")
  async budget(@Body() body: BudgetDto) {
    const created = await this.prisma.budgetRequest.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        weddingDate: body.weddingDate ? asDate(body.weddingDate) : null,
        venue: body.venue || null,
        hasPlanner: body.hasPlanner,
        source: body.source,
      },
    });
    const text = budgetWhatsAppText({
      name: body.name,
      phone: body.phone,
      email: body.email,
      weddingDate: body.weddingDate,
      venue: body.venue,
      hasPlanner: body.hasPlanner,
      source: body.source,
    });
    const team = process.env.TEAM_EMAIL;
    if (team) {
      await this.notifications.enqueue("notifications", "send", {
        type: "BUDGET",
        entityType: "budget",
        entityId: created.id,
        reference: created.id,
        to: team,
        subject: `Orçamento — ${body.name}`,
        text,
      });
    }
    return {
      id: created.id,
      message: "Pedido recebido. A equipe também recebe uma cópia por e-mail. Se preferir, envie agora pelo WhatsApp.",
      whatsAppUrl: whatsAppLink(process.env.WHATSAPP_PHONE ?? "", text),
    };
  }
}

@ApiTags("health")
@Controller("health")
class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @SkipThrottle()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const pong = await this.redis.ping();
      if (pong !== "PONG") throw new Error("redis");
    } catch {
      throw new ServiceUnavailableException("Dependência indisponível.");
    }
    return { status: "ok" };
  }
}

@Module({
  controllers: [PublicController, HealthController],
})
export class PublicModule {}
