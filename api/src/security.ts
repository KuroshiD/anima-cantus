import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestMiddleware,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { randomUUID, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "@anima/shared";

export const SESSION_COOKIE = "anima_session";
export const PREAUTH_COOKIE = "anima_preauth";
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7);

export interface AuthUser {
  userId: string;
  role: Role;
  coupleId: string | null;
  email: string;
  csrfToken: string;
}

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function cookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds * 1000 }),
  };
}

export function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const allowed = (process.env.APP_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;
  return Boolean(host) && url.host === host;
}

type SessionLoader = (cookieHeader?: string) => Promise<AuthUser | null>;
let sessionLoader: SessionLoader = async () => null;

export function setSessionLoader(loader: SessionLoader): void {
  sessionLoader = loader;
}

export async function adminBoardMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await sessionLoader(req.headers.cookie);
  if (session?.role !== "ADMIN") {
    res.status(401).type("text/plain").send("Acesso administrativo necessário.");
    return;
  }
  next();
}

@Injectable()
export class OriginMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    const path = req.originalUrl.split("?")[0];
    if (["GET", "HEAD", "OPTIONS"].includes(method) || path.startsWith("/queues") || path.startsWith("/docs") || path.startsWith("/health")) {
      next();
      return;
    }
    if (!originAllowed(req.header("origin"), req.header("host"))) {
      res.status(403).json({ message: "Origem da requisição não autorizada." });
      return;
    }
    next();
  }
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const incoming = req.header("x-request-id");
    const id = req.id || incoming || randomUUID();
    res.setHeader("x-request-id", id);
    next();
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user || !roles.includes(request.user.role)) {
      throw new ForbiddenException("Acesso restrito à equipe.");
    }
    return true;
  }
}

export function requireUser(request: { user?: AuthUser }): AuthUser {
  if (!request.user) throw new UnauthorizedException("Faça login para continuar.");
  return request.user;
}

export function requireCoupleId(request: { user?: AuthUser }): string {
  const user = requireUser(request);
  if (!user.coupleId) throw new ForbiddenException("Esta área é do casal.");
  return user.coupleId;
}
