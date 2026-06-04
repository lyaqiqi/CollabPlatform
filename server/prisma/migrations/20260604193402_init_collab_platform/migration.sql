-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
CREATE TYPE "UserStatus" AS ENUM ('active', 'banned');
CREATE TYPE "ItemType" AS ENUM ('Whiteboard', 'Document');
CREATE TYPE "PermissionRole" AS ENUM ('owner', 'editor', 'viewer');

-- Create tables
CREATE TABLE "User" (
  "user_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "username" VARCHAR(32) NOT NULL,
  "email" VARCHAR(128) NOT NULL,
  "password_hash" VARCHAR(256) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "CollaborativeItem" (
  "item_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "type" "ItemType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "title" VARCHAR(256) NOT NULL,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "content_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CollaborativeItem_pkey" PRIMARY KEY ("item_id")
);

CREATE TABLE "Permission" (
  "permission_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "role" "PermissionRole" NOT NULL,

  CONSTRAINT "Permission_pkey" PRIMARY KEY ("permission_id")
);

CREATE TABLE "Version" (
  "version_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL,
  "content_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Version_pkey" PRIMARY KEY ("version_id")
);

CREATE TABLE "Comment" (
  "comment_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "position" JSONB NOT NULL,
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Comment_pkey" PRIMARY KEY ("comment_id")
);

-- Unique indexes
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Permission_user_id_item_id_key" ON "Permission"("user_id", "item_id");

-- Foreign keys
ALTER TABLE "CollaborativeItem"
  ADD CONSTRAINT "CollaborativeItem_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "User"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "CollaborativeItem"("item_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Version"
  ADD CONSTRAINT "Version_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "CollaborativeItem"("item_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "CollaborativeItem"("item_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "User"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
