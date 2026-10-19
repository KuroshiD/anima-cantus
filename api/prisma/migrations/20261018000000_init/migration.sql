-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "role" AS ENUM ('COUPLE', 'ADMIN');

-- CreateEnum
CREATE TYPE "journey_step_key" AS ENUM ('CADASTRO', 'CONTRATO', 'REPERTORIO', 'CASAMENTO', 'POS_EVENTO');

-- CreateEnum
CREATE TYPE "stage_status" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "service_kind" AS ENUM ('PACOTE', 'SERVICO', 'ADICIONAL');

-- CreateEnum
CREATE TYPE "file_kind" AS ENUM ('GERADO', 'ASSINADO');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "notification_delivery" AS ENUM ('ENVIADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "token_purpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "couple_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "token_purpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple" (
    "id" UUID NOT NULL,
    "partner_one" TEXT NOT NULL,
    "partner_two" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "legal_name" TEXT,
    "document_id" TEXT,
    "address" TEXT,
    "wedding_date" DATE NOT NULL,
    "wedding_time" TEXT,
    "venue" TEXT,
    "formation" TEXT,
    "payment_terms" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey" (
    "id" UUID NOT NULL,
    "couple_id" UUID NOT NULL,
    "repertoire_window_start" DATE,
    "repertoire_window_end" DATE,
    "anniversary_send_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_step" (
    "id" UUID NOT NULL,
    "journey_id" UUID NOT NULL,
    "step" "journey_step_key" NOT NULL,
    "status" "stage_status" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_item" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "service_kind" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" UUID NOT NULL,
    "couple_id" UUID NOT NULL,
    "status" "stage_status" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "upload_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_item" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "contract_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_snapshot" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL,
    "total_in_words" TEXT NOT NULL,
    "payment_terms" TEXT NOT NULL,
    "items_json" JSONB NOT NULL,
    "legal_name" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "wedding_date" DATE NOT NULL,
    "wedding_time" TEXT,
    "venue" TEXT NOT NULL,
    "formation" TEXT,
    "address" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_file" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "kind" "file_kind" NOT NULL,
    "object_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_validation" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "admin_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceremony_moment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "ceremony_moment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repertoire_selection" (
    "id" UUID NOT NULL,
    "couple_id" UUID NOT NULL,
    "moment_id" UUID NOT NULL,
    "song_title" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repertoire_selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tip" (
    "id" UUID NOT NULL,
    "moment_id" UUID,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "music_tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_request" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "wedding_date" DATE,
    "venue" TEXT,
    "has_planner" BOOLEAN,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "notification_delivery" NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_item" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "media_url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gallery_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "alert_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "reminder_lead_days" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_heartbeat" (
    "id" TEXT NOT NULL,
    "ran_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_heartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_couple_id_key" ON "app_user"("couple_id");

-- CreateIndex
CREATE INDEX "email_token_token_hash_idx" ON "email_token"("token_hash");

-- CreateIndex
CREATE INDEX "couple_wedding_date_idx" ON "couple"("wedding_date");

-- CreateIndex
CREATE UNIQUE INDEX "journey_couple_id_key" ON "journey"("couple_id");

-- CreateIndex
CREATE UNIQUE INDEX "journey_step_journey_id_step_key" ON "journey_step"("journey_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "contract_couple_id_key" ON "contract"("couple_id");

-- CreateIndex
CREATE INDEX "contract_status_idx" ON "contract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_item_contract_id_service_id_key" ON "contract_item"("contract_id", "service_id");

-- CreateIndex
CREATE INDEX "contract_snapshot_contract_id_created_at_idx" ON "contract_snapshot"("contract_id", "created_at");

-- CreateIndex
CREATE INDEX "contract_file_contract_id_kind_idx" ON "contract_file"("contract_id", "kind");

-- CreateIndex
CREATE INDEX "contract_validation_contract_id_created_at_idx" ON "contract_validation"("contract_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "repertoire_selection_couple_id_moment_id_key" ON "repertoire_selection"("couple_id", "moment_id");

-- CreateIndex
CREATE INDEX "notification_log_type_entity_type_entity_id_channel_referen_idx" ON "notification_log"("type", "entity_type", "entity_id", "channel", "reference");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_token" ADD CONSTRAINT "email_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey" ADD CONSTRAINT "journey_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_step" ADD CONSTRAINT "journey_step_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_item" ADD CONSTRAINT "contract_item_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_item" ADD CONSTRAINT "contract_item_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_snapshot" ADD CONSTRAINT "contract_snapshot_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_file" ADD CONSTRAINT "contract_file_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_file" ADD CONSTRAINT "contract_file_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "contract_snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_validation" ADD CONSTRAINT "contract_validation_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_validation" ADD CONSTRAINT "contract_validation_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repertoire_selection" ADD CONSTRAINT "repertoire_selection_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repertoire_selection" ADD CONSTRAINT "repertoire_selection_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "ceremony_moment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_tip" ADD CONSTRAINT "music_tip_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "ceremony_moment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checks, índices parciais e imutabilidade do snapshot (RF18, RNF10, RNF12)
ALTER TABLE "service_item" ADD CONSTRAINT "service_item_price_nonneg" CHECK ("price_cents" >= 0);
ALTER TABLE "contract" ADD CONSTRAINT "contract_discount_nonneg" CHECK ("discount_cents" >= 0);
ALTER TABLE "contract" ADD CONSTRAINT "contract_status_chk" CHECK ("status" IN ('EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO', 'CONCLUIDA'));
ALTER TABLE "contract_snapshot" ADD CONSTRAINT "contract_snapshot_total_nonneg" CHECK ("total_cents" >= 0 AND "discount_cents" >= 0);
ALTER TABLE "contract_file" ADD CONSTRAINT "contract_file_size_positive" CHECK ("size_bytes" > 0);
ALTER TABLE "alert_config" ADD CONSTRAINT "alert_config_lead_range" CHECK ("reminder_lead_days" BETWEEN 0 AND 60);

CREATE UNIQUE INDEX "notification_log_sent_uidx"
  ON "notification_log" ("type", "entity_type", "entity_id", "channel", "reference")
  WHERE "status" = 'ENVIADO';

CREATE INDEX "contract_awaiting_validation_idx"
  ON "contract" ("id")
  WHERE "status" = 'AGUARDANDO_VALIDACAO';

CREATE OR REPLACE FUNCTION contract_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'contract_snapshot é imutável (RF18, RNF10)';
END;
$$;

CREATE TRIGGER contract_snapshot_no_mutation
BEFORE UPDATE OR DELETE ON "contract_snapshot"
FOR EACH ROW
EXECUTE FUNCTION contract_snapshot_immutable();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anima_app') THEN
    GRANT USAGE ON SCHEMA public TO anima_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anima_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anima_app;
    REVOKE UPDATE, DELETE ON TABLE "contract_snapshot" FROM anima_app;
  END IF;
END $$;
