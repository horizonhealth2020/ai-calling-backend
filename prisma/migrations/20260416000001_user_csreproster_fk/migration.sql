-- AlterTable
ALTER TABLE "users" ADD COLUMN "cs_rep_roster_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_cs_rep_roster_id_key" ON "users"("cs_rep_roster_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cs_rep_roster_id_fkey" FOREIGN KEY ("cs_rep_roster_id") REFERENCES "cs_rep_roster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
