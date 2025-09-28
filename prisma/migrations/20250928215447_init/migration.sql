-- CreateEnum
CREATE TYPE "public"."Chat" AS ENUM ('grouche_dao', 'grouche_whales', 'notwise_holders');

-- CreateTable
CREATE TABLE "public"."User" (
    "tgId" BIGINT NOT NULL,
    "wallet" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("tgId")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "chat" "public"."Chat" NOT NULL,
    "userId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("userId","chat")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "public"."User"("wallet");

-- CreateIndex
CREATE INDEX "Member_chat_idx" ON "public"."Member"("chat");

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("tgId") ON DELETE CASCADE ON UPDATE CASCADE;
