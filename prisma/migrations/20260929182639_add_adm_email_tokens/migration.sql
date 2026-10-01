-- CreateEnum
CREATE TYPE "AdmEmailTokenPurpose" AS ENUM ('invite', 'password_reset');

-- CreateTable
CREATE TABLE "adm_email_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "adm_id" INTEGER,
    "purpose" "AdmEmailTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by_adm_id" INTEGER,

    CONSTRAINT "adm_email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adm_email_tokens_tokenHash_key" ON "adm_email_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "adm_email_tokens" ADD CONSTRAINT "adm_email_tokens_adm_id_fkey" FOREIGN KEY ("adm_id") REFERENCES "adms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adm_email_tokens" ADD CONSTRAINT "adm_email_tokens_invited_by_adm_id_fkey" FOREIGN KEY ("invited_by_adm_id") REFERENCES "adms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
