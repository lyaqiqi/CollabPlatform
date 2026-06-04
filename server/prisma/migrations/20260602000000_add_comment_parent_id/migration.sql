-- AlterTable: 为评论添加 parent_id 支持回复功能
ALTER TABLE "Comment" ADD COLUMN "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "Comment"("comment_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
