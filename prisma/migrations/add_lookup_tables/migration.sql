-- ============================================================
-- LOOKUP TABLES: activity, theme, category
-- ============================================================

-- 1. Create the lookup tables
-- ============================================================

CREATE TABLE "activity" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "modified_at" TIMESTAMPTZ,
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "theme" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "modified_at" TIMESTAMPTZ,
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "category" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "modified_at" TIMESTAMPTZ,
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- 2. Add new columns to project (all optional)
-- ============================================================

ALTER TABLE "project"
    ADD COLUMN "project_code" TEXT,
    ADD COLUMN "activity_id"  UUID,
    ADD COLUMN "theme_id"     UUID,
    ADD COLUMN "category_id"  UUID;

-- 3. Foreign key constraints
-- ============================================================

ALTER TABLE "project"
    ADD CONSTRAINT "project_activity_id_fkey"
        FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "project_theme_id_fkey"
        FOREIGN KEY ("theme_id") REFERENCES "theme"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "project_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Indexes for faster joins/filters
-- ============================================================

CREATE INDEX "project_activity_id_idx" ON "project"("activity_id");
CREATE INDEX "project_theme_id_idx"    ON "project"("theme_id");
CREATE INDEX "project_category_id_idx" ON "project"("category_id");
