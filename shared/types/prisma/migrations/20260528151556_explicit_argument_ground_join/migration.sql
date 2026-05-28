-- Replace the implicit many-to-many join table "_ArgumentGrounds" (PascalCase,
-- Prisma-generated) with an explicit join model mapped to "argument_ground".
-- Table is empty, so DROP/CREATE loses no data.

-- DropForeignKey
ALTER TABLE "_ArgumentGrounds" DROP CONSTRAINT "_ArgumentGrounds_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArgumentGrounds" DROP CONSTRAINT "_ArgumentGrounds_B_fkey";

-- DropTable
DROP TABLE "_ArgumentGrounds";

-- CreateTable
CREATE TABLE "argument_ground" (
    "answer_id" TEXT NOT NULL,
    "argument_id" TEXT NOT NULL,

    CONSTRAINT "argument_ground_pkey" PRIMARY KEY ("answer_id","argument_id")
);

-- CreateIndex
CREATE INDEX "argument_ground_argument_id_idx" ON "argument_ground"("argument_id");

-- AddForeignKey
ALTER TABLE "argument_ground" ADD CONSTRAINT "argument_ground_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "argument_ground" ADD CONSTRAINT "argument_ground_argument_id_fkey" FOREIGN KEY ("argument_id") REFERENCES "argument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
