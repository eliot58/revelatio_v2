-- CreateEnum
CREATE TYPE "public"."Chat" AS ENUM ('grouche_dao', 'grouche_whales', 'notwise_holders');

-- CreateTable
CREATE TABLE "public"."User" (
    "tgId" BIGINT NOT NULL,
    "wallet" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("tgId")
);

-- CreateTable
CREATE TABLE "public"."Link" (
    "id" SERIAL NOT NULL,
    "invite_link" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "user_id" BIGINT,
    "chat" "public"."Chat" NOT NULL,
    "expired_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_invite_link_key" ON "public"."Link"("invite_link");

-- CreateIndex
CREATE INDEX "Link_user_id_idx" ON "public"."Link"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Link_wallet_chat_key" ON "public"."Link"("wallet", "chat");
