-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('draft', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "AplicadorStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateTable
CREATE TABLE "exams" (
    "exam_id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "qtd_questoes" INTEGER NOT NULL,
    "nota_simbolica" INTEGER NOT NULL DEFAULT 1000,
    "status" "ExamStatus" NOT NULL DEFAULT 'draft',
    "encerramento" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("exam_id")
);

-- CreateTable
CREATE TABLE "adms" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicadores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "AplicadorStatus" NOT NULL DEFAULT 'PENDENTE',
    "prova_id" INTEGER NOT NULL,
    "aprovado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "presenca" BOOLEAN NOT NULL DEFAULT true,
    "redacao_nota" DOUBLE PRECISION,
    "exam_id" INTEGER NOT NULL,
    "aplicador_id" INTEGER,

    CONSTRAINT "participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questoes" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "peso" INTEGER NOT NULL DEFAULT 1,
    "question_correct_answer" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "alternativas" JSONB NOT NULL,
    "exam_id" INTEGER NOT NULL,

    CONSTRAINT "questoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados" (
    "id" SERIAL NOT NULL,
    "alternativa" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "manually_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER NOT NULL,
    "quest_id" INTEGER NOT NULL,

    CONSTRAINT "resultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adms_email_key" ON "adms"("email");

-- CreateIndex
CREATE INDEX "aplicadores_prova_id_idx" ON "aplicadores"("prova_id");

-- CreateIndex
CREATE INDEX "participantes_exam_id_idx" ON "participantes"("exam_id");

-- CreateIndex
CREATE INDEX "participantes_aplicador_id_idx" ON "participantes"("aplicador_id");

-- CreateIndex
CREATE INDEX "questoes_exam_id_idx" ON "questoes"("exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "questoes_exam_id_numero_key" ON "questoes"("exam_id", "numero");

-- CreateIndex
CREATE INDEX "resultados_user_id_idx" ON "resultados"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_user_id_quest_id_key" ON "resultados"("user_id", "quest_id");

-- AddForeignKey
ALTER TABLE "aplicadores" ADD CONSTRAINT "aplicadores_prova_id_fkey" FOREIGN KEY ("prova_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_aplicador_id_fkey" FOREIGN KEY ("aplicador_id") REFERENCES "aplicadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questoes" ADD CONSTRAINT "questoes_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "questoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
