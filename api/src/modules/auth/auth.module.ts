import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  OnModuleInit,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Throttle } from "@nestjs/throttler";
import { createZodDto } from "nestjs-zod";
import { ApiTags } from "@nestjs/swagger";
import argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  anniversaryIso,
  repertoireWindow,
} from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { RedisService } from "../../redis.service";
import { NotificationsService } from "../../notifications.service";
import {
  AuthUser,
  cookieOptions,
  PREAUTH_COOKIE,
  requireUser,
  safeEqual,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  setSessionLoader,
} from "../../security";

class RegisterDto extends createZodDto(registerSchema) {}
class LoginDto extends createZodDto(loginSchema) {}
class ForgotDto extends createZodDto(forgotPasswordSchema) {}
class ResetDto extends createZodDto(resetPasswordSchema) {}
class VerifyDto extends createZodDto(verifyEmailSchema) {}

function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function requestCookie(req: Request, name: string): string | undefined {
  return req.cookies?.[name] as string | undefined;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    setSessionLoader((cookieHeader) => this.sessionFromHeader(cookieHeader));
  }

  async sessionFromHeader(cookieHeader?: string): Promise<AuthUser | null> {
    if (!cookieHeader) return null;
    const pair = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    if (!pair) return null;
    return this.readSession(decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1)));
  }

  async readSession(id?: string): Promise<AuthUser | null> {
    if (!id) return null;
    const raw = await this.redis.get(`session:${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  }

  async current(req: Request): Promise<AuthUser | null> {
    return this.readSession(requestCookie(req, SESSION_COOKIE));
  }

  async assertCsrf(req: Request): Promise<void> {
    const header = req.header("x-csrf-token");
    if (!header) throw new ForbiddenException("Token de segurança ausente.");
    const session = await this.current(req);
    if (session && safeEqual(session.csrfToken, header)) return;
    const preauth = requestCookie(req, PREAUTH_COOKIE);
    if (preauth) {
      const stored = await this.redis.get(`preauth:${preauth}`);
      if (stored && safeEqual(stored, header)) return;
    }
    throw new ForbiddenException("Token de segurança inválido.");
  }

  async issueCsrf(req: Request, res: Response): Promise<{ token: string }> {
    const session = await this.current(req);
    if (session) return { token: session.csrfToken };
    const id = randomBytes(32).toString("base64url");
    const token = randomBytes(32).toString("base64url");
    await this.redis.set(`preauth:${id}`, token, "EX", 60 * 30);
    res.cookie(PREAUTH_COOKIE, id, cookieOptions(60 * 30));
    return { token };
  }

  private async openSession(
    res: Response,
    user: { id: string; role: "COUPLE" | "ADMIN"; email: string; coupleId: string | null },
    rememberMe: boolean,
  ): Promise<string> {
    const id = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    const data: AuthUser = { userId: user.id, role: user.role, email: user.email, coupleId: user.coupleId, csrfToken };
    await this.redis.set(`session:${id}`, JSON.stringify(data), "EX", SESSION_TTL_SECONDS);
    await this.redis.sadd(`user-sessions:${user.id}`, id);
    await this.redis.expire(`user-sessions:${user.id}`, SESSION_TTL_SECONDS);
    res.cookie(SESSION_COOKIE, id, cookieOptions(rememberMe ? SESSION_TTL_SECONDS : undefined));
    res.clearCookie(PREAUTH_COOKIE, { path: "/" });
    return csrfToken;
  }

  async revoke(req: Request, res: Response): Promise<void> {
    const id = requestCookie(req, SESSION_COOKIE);
    const session = await this.readSession(id);
    if (id) await this.redis.del(`session:${id}`);
    if (session && id) await this.redis.srem(`user-sessions:${session.userId}`, id);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  private async revokeAll(userId: string): Promise<void> {
    const ids = await this.redis.smembers(`user-sessions:${userId}`);
    if (ids.length) await this.redis.del(...ids.map((id) => `session:${id}`));
    await this.redis.del(`user-sessions:${userId}`);
  }

  async register(input: RegisterDto): Promise<{ message: string }> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ForbiddenException("Já existe uma conta com esse e-mail.");
    const wedding = new Date(`${input.weddingDate}T00:00:00.000Z`);
    const window = repertoireWindow(input.weddingDate);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.$transaction(async (tx) => {
      const couple = await tx.couple.create({
        data: {
          partnerOne: input.partnerOne,
          partnerTwo: input.partnerTwo,
          email,
          phone: input.phone,
          weddingDate: wedding,
          venue: input.venue || null,
        },
      });
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "COUPLE",
          coupleId: couple.id,
          termsAcceptedAt: new Date(),
          termsVersion: input.termsVersion,
        },
      });
      await tx.journey.create({
        data: {
          coupleId: couple.id,
          repertoireWindowStart: new Date(`${window.start}T00:00:00.000Z`),
          repertoireWindowEnd: new Date(`${window.end}T00:00:00.000Z`),
          anniversarySendOn: new Date(`${anniversaryIso(input.weddingDate)}T00:00:00.000Z`),
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
      await tx.contract.create({ data: { coupleId: couple.id, status: "EM_ANDAMENTO" } });
      return created;
    });
    await this.sendToken(user.id, email, "VERIFY_EMAIL");
    return { message: "Conta criada. Enviamos um link para confirmar o e-mail." };
  }

  async login(input: LoginDto, res: Response): Promise<{ role: string; csrfToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    const valid = user ? await argon2.verify(user.passwordHash, input.password).catch(() => false) : false;
    if (!user || !valid) throw new UnauthorizedException("E-mail ou senha inválidos.");
    if (!user.emailVerifiedAt) throw new ForbiddenException("Confirme o e-mail antes de entrar.");
    const csrfToken = await this.openSession(res, user, input.rememberMe);
    return { role: user.role, csrfToken };
  }

  async sendToken(userId: string, email: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD"): Promise<void> {
    const raw = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.emailToken.create({
      data: { userId, purpose, tokenHash: tokenHash(raw), expiresAt },
    });
    const origin = process.env.PUBLIC_WEB_ORIGIN ?? "http://localhost";
    const path = purpose === "VERIFY_EMAIL" ? "verificar-email" : "redefinir-senha";
    const subject = purpose === "VERIFY_EMAIL" ? "Confirme seu e-mail — Anima Cantus" : "Redefina sua senha — Anima Cantus";
    const text = `Use este link em até 30 minutos. Ele só pode ser usado uma vez:\n${origin}/${path}?token=${raw}\n\nSe você não pediu isso, ignore esta mensagem.`;
    await this.notifications.enqueue("notifications", "send", {
      type: purpose,
      entityType: "user",
      entityId: userId,
      reference: tokenHash(raw),
      to: email,
      subject,
      text,
    });
  }

  async verify(input: VerifyDto): Promise<{ message: string }> {
    await this.consumeToken(input.token, "VERIFY_EMAIL", async (userId) => {
      await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    });
    return { message: "E-mail confirmado. Você já pode entrar." };
  }

  async forgot(input: ForgotDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (user) await this.sendToken(user.id, user.email, "RESET_PASSWORD");
    return { message: "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha." };
  }

  async resend(req: Request): Promise<{ message: string }> {
    const session = await this.current(req);
    if (!session) throw new UnauthorizedException("Faça login para continuar.");
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (user && !user.emailVerifiedAt) await this.sendToken(user.id, user.email, "VERIFY_EMAIL");
    return { message: "Se a conta ainda não foi confirmada, enviamos um novo link." };
  }

  async resendByEmail(input: ForgotDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (user && !user.emailVerifiedAt) await this.sendToken(user.id, user.email, "VERIFY_EMAIL");
    return { message: "Se a conta ainda não foi confirmada, enviaremos um novo link para esse endereço." };
  }

  async reset(input: ResetDto): Promise<{ message: string }> {
    await this.consumeToken(input.token, "RESET_PASSWORD", async (userId) => {
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: new Date() } });
      await this.revokeAll(userId);
    });
    return { message: "Senha redefinida. Entre novamente." };
  }

  private async consumeToken(raw: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD", effect: (userId: string) => Promise<void>): Promise<void> {
    const row = await this.prisma.emailToken.findFirst({
      where: { tokenHash: tokenHash(raw), purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new ForbiddenException("Link inválido ou expirado.");
    const used = await this.prisma.emailToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) throw new ForbiddenException("Este link já foi usado.");
    await effect(row.userId);
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const session = await this.auth.current(request);
    if (!session) throw new UnauthorizedException("Faça login para continuar.");
    request.user = session;
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const path = request.originalUrl.split("?")[0];
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
    if (path.startsWith("/queues") || path.startsWith("/docs") || path.startsWith("/health")) return true;
    await this.auth.assertCsrf(request);
    return true;
  }
}

@ApiTags("auth")
@Controller("auth")
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("csrf")
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.issueCsrf(req, res);
  }

  @Get("me")
  async me(@Req() req: Request) {
    const session = await this.auth.current(req);
    if (!session) return { authenticated: false };
    return { authenticated: true, role: session.role, email: session.email, coupleId: session.coupleId };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body, res);
  }

  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.revoke(req, res);
  }

  @Post("verificar-email")
  verify(@Body() body: VerifyDto) {
    return this.auth.verify(body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("recuperar-senha")
  forgot(@Body() body: ForgotDto) {
    return this.auth.forgot(body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("redefinir-senha")
  reset(@Body() body: ResetDto) {
    return this.auth.reset(body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reenviar-verificacao")
  resend(@Req() req: Request) {
    return this.auth.resend(req);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reenviar-verificacao-email")
  resendByEmail(@Body() body: ForgotDto) {
    return this.auth.resendByEmail(body);
  }
}

export { requireUser };

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, CsrfGuard, { provide: APP_GUARD, useClass: CsrfGuard }],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
