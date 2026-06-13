-- 文档树/文件夹（C）：新增 Folder 表 + CollaborativeItem.folder_id

CREATE TABLE "Folder" (
  "folder_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "name" VARCHAR(128) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Folder_pkey" PRIMARY KEY ("folder_id")
);

CREATE INDEX "Folder_owner_id_parent_id_idx" ON "Folder"("owner_id", "parent_id");

ALTER TABLE "CollaborativeItem" ADD COLUMN "folder_id" TEXT;

ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "User"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "Folder"("folder_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollaborativeItem"
  ADD CONSTRAINT "CollaborativeItem_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "Folder"("folder_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
