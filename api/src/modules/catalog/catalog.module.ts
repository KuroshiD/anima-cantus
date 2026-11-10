import { Body, Controller, Get, Module, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { serviceOptionWriteSchema, serviceWriteSchema } from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { Roles, RolesGuard } from "../../security";

class ServiceDto extends createZodDto(serviceWriteSchema) {}
class ServiceOptionDto extends createZodDto(serviceOptionWriteSchema) {}

@ApiTags("servicos")
@Controller()
class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("servicos")
  @UseGuards(SessionGuard)
  list() {
    return this.prisma.serviceItem.findMany({
      where: { active: true },
      include: { options: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
}

@ApiTags("admin")
@Controller("admin/servicos")
@UseGuards(SessionGuard, RolesGuard)
@Roles("ADMIN")
class AdminCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  all() {
    return this.prisma.serviceItem.findMany({
      include: { options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  @Post()
  create(@Body() body: ServiceDto) {
    return this.prisma.serviceItem.create({
      data: {
        name: body.name,
        description: body.description || null,
        kind: body.kind,
        priceCents: body.priceCents,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: ServiceDto) {
    return this.prisma.serviceItem.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        kind: body.kind,
        priceCents: body.priceCents,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
  }

  @Post(":serviceId/opcoes")
  createOption(@Param("serviceId") serviceId: string, @Body() body: ServiceOptionDto) {
    return this.prisma.serviceOption.create({
      data: {
        serviceId,
        label: body.label,
        priceCents: body.priceCents,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
  }

  @Patch(":serviceId/opcoes/:id")
  updateOption(@Param("serviceId") serviceId: string, @Param("id") id: string, @Body() body: ServiceOptionDto) {
    return this.prisma.serviceOption.update({
      where: { id, serviceId },
      data: {
        label: body.label,
        priceCents: body.priceCents,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [RolesGuard],
})
export class CatalogModule {}
