-- AlterTable: add consulta_code with backfill then NOT NULL + unique per exam
ALTER TABLE "participantes" ADD COLUMN "consulta_code" TEXT;

UPDATE "participantes" SET "consulta_code" = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE "consulta_code" IS NULL;

ALTER TABLE "participantes" ALTER COLUMN "consulta_code" SET NOT NULL;

CREATE UNIQUE INDEX "participantes_exam_id_consulta_code_key" ON "participantes"("exam_id", "consulta_code");
