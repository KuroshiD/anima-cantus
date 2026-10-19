import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { patchNestJsSwagger, ZodValidationPipe } from "nestjs-zod";
import cookieParser from "cookie-parser";
import { AppModule } from "./app/app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  const http = app.getHttpAdapter().getInstance();
  http.set("trust proxy", 1);
  app.useGlobalPipes(new ZodValidationPipe());
  patchNestJsSwagger();
  const config = new DocumentBuilder()
    .setTitle("Anima Cantus")
    .setDescription("API da jornada do casal. A sessão vai em cookie httpOnly; o nginx remove o prefixo /api.")
    .setVersion("1.0")
    .addCookieAuth("anima_session")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
}

void bootstrap();
