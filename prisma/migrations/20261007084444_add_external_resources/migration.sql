-- CreateTable
CREATE TABLE "ExternalCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalResource" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "telegramChatId" TEXT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "telegramFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalCategory_parentId_idx" ON "ExternalCategory"("parentId");

-- CreateIndex
CREATE INDEX "ExternalResource_categoryId_idx" ON "ExternalResource"("categoryId");

-- CreateIndex
CREATE INDEX "ExternalResource_telegramChatId_telegramMessageId_idx" ON "ExternalResource"("telegramChatId", "telegramMessageId");

-- AddForeignKey
ALTER TABLE "ExternalCategory" ADD CONSTRAINT "ExternalCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExternalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalResource" ADD CONSTRAINT "ExternalResource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExternalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
