CREATE TABLE "service_option" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_option_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "service_option"
ADD CONSTRAINT "service_option_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "service_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "service_option_service_id_active_idx" ON "service_option"("service_id", "active");

ALTER TABLE "couple"
ADD COLUMN "additional_instrumentist_option_id" UUID;
