


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."audit_action" AS ENUM (
    'CREATE',
    'UPDATE',
    'END',
    'DELETE'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."entity_state" AS ENUM (
    'ACTIVE',
    'ENDED'
);


ALTER TYPE "public"."entity_state" OWNER TO "postgres";


CREATE TYPE "public"."project_role" AS ENUM (
    'DIRECTOR',
    'MANAGER',
    'CONTRIBUTOR'
);


ALTER TYPE "public"."project_role" OWNER TO "postgres";


CREATE TYPE "public"."system_role" AS ENUM (
    'ADMIN',
    'USER'
);


ALTER TYPE "public"."system_role" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'LOW',
    'NORMAL',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."todo_status" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE "public"."todo_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_actor_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::UUID;
$$;


ALTER FUNCTION "public"."app_actor_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_has_min_role"("p_project_id" "uuid", "p_min_role" "public"."project_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_member
    WHERE project_id = p_project_id
      AND actor_id = app_actor_id()
      AND deleted_at IS NULL
      AND CASE role
            WHEN 'DIRECTOR' THEN 3
            WHEN 'MANAGER' THEN 2
            WHEN 'CONTRIBUTOR' THEN 1
          END
          >=
          CASE p_min_role
            WHEN 'DIRECTOR' THEN 3
            WHEN 'MANAGER' THEN 2
            WHEN 'CONTRIBUTOR' THEN 1
          END
  );
$$;


ALTER FUNCTION "public"."app_has_min_role"("p_project_id" "uuid", "p_min_role" "public"."project_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT current_setting('app.system_role', true) = 'ADMIN';
$$;


ALTER FUNCTION "public"."app_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_is_project_member"("p_project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_member
    WHERE project_id = p_project_id
      AND actor_id = app_actor_id()
      AND deleted_at IS NULL
  );
$$;


ALTER FUNCTION "public"."app_is_project_member"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_action       audit_action;
  v_old_data     jsonb;
  v_new_data     jsonb;
  v_changed      jsonb;
  v_record_id    uuid;
  v_project_id   uuid;
  v_task_id      uuid;
  v_actor_id     uuid;
  v_row          jsonb;
BEGIN
  v_actor_id := NULLIF(current_setting('app.actor_id', true), '')::uuid;

  IF TG_OP = 'INSERT' THEN
    v_action   := 'CREATE';
    v_new_data := to_jsonb(NEW);
    v_row      := v_new_data;
    v_record_id := NEW.id;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_row      := v_new_data;
    v_record_id := NEW.id;

    IF v_old_data->>'deleted_at' IS NULL AND v_new_data->>'deleted_at' IS NOT NULL THEN
      v_action := 'DELETE';
    ELSE
      v_action := 'UPDATE';
    END IF;

    -- Build changed-fields object
    SELECT jsonb_object_agg(key, value)
      INTO v_changed
      FROM jsonb_each(v_new_data) AS n(key, value)
     WHERE n.value IS DISTINCT FROM v_old_data -> n.key
       AND n.key NOT IN ('modified_at', 'version');

  ELSIF TG_OP = 'DELETE' THEN
    v_action   := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_row      := v_old_data;
    v_record_id := OLD.id;
  END IF;

  -- Resolve project_id
  v_project_id := CASE TG_TABLE_NAME
    WHEN 'program'        THEN NULL
    WHEN 'project'        THEN v_record_id
    WHEN 'project_member' THEN (v_row->>'project_id')::uuid
    WHEN 'task'           THEN (v_row->>'project_id')::uuid
    WHEN 'todo'           THEN (v_row->>'project_id')::uuid
    WHEN 'review'         THEN (v_row->>'project_id')::uuid
    WHEN 'deliverable'    THEN (SELECT project_id FROM task WHERE id = (v_row->>'task_id')::uuid)
    WHEN 'attachment'     THEN (SELECT t.project_id FROM task t JOIN deliverable d ON d.task_id = t.id WHERE d.id = (v_row->>'deliverable_id')::uuid)
  END;

  -- Resolve task_id
  v_task_id := CASE TG_TABLE_NAME
    WHEN 'task'        THEN v_record_id
    WHEN 'deliverable' THEN (v_row->>'task_id')::uuid
    WHEN 'attachment'  THEN (SELECT task_id FROM deliverable WHERE id = (v_row->>'deliverable_id')::uuid)
    ELSE NULL
  END;

  INSERT INTO audit_log (table_name, record_id, action, project_id, task_id, old_data, new_data, changed_fields, actor_id)
  VALUES (TG_TABLE_NAME, v_record_id, v_action, v_project_id, v_task_id, v_old_data, v_new_data, v_changed, v_actor_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."fn_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cascade_soft_delete_deliverable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE attachment
       SET deleted_at = NEW.deleted_at
     WHERE deliverable_id = NEW.id
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_cascade_soft_delete_deliverable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cascade_soft_delete_program"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE project
       SET deleted_at = NEW.deleted_at
     WHERE program_id = NEW.id
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_cascade_soft_delete_program"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cascade_soft_delete_project"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE task
       SET deleted_at = NEW.deleted_at
     WHERE project_id = NEW.id
       AND deleted_at IS NULL;

    UPDATE todo
       SET deleted_at = NEW.deleted_at
     WHERE project_id = NEW.id
       AND deleted_at IS NULL;

    UPDATE project_member
       SET deleted_at = NEW.deleted_at
     WHERE project_id = NEW.id
       AND deleted_at IS NULL;

    UPDATE review
       SET deleted_at = NEW.deleted_at
     WHERE project_id = NEW.id
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_cascade_soft_delete_project"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cascade_soft_delete_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE deliverable
       SET deleted_at = NEW.deleted_at
     WHERE task_id = NEW.id
       AND deleted_at IS NULL;

    UPDATE time_entry
       SET deleted_at = NEW.deleted_at
     WHERE task_id = NEW.id
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_cascade_soft_delete_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_modified_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.modified_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_update_modified_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "code" character varying(50) NOT NULL
);

ALTER TABLE ONLY "public"."activity" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."actor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" "text" NOT NULL,
    "system_role" "public"."system_role" DEFAULT 'USER'::"public"."system_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "from_ad" boolean DEFAULT false NOT NULL,
    "hourly_rate" numeric(8,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."actor" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."actor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "file_url" "text",
    "file_type" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_size" integer,
    "uploaded_by_id" "uuid"
);

ALTER TABLE ONLY "public"."attachment" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."attachment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "action" "public"."audit_action" NOT NULL,
    "project_id" "uuid",
    "task_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_fields" "jsonb",
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "code" character varying(50) NOT NULL
);

ALTER TABLE ONLY "public"."category" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverable" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "type" character varying(100),
    "task_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_by_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "chk_deliverable_version" CHECK (("version" >= 1))
);

ALTER TABLE ONLY "public"."deliverable" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliverable" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "state" "public"."entity_state" DEFAULT 'ACTIVE'::"public"."entity_state" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "budget_estimated" numeric(12,2),
    "currency" character varying(3) DEFAULT 'EUR'::character varying,
    "created_by_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "chk_program_budget" CHECK ((("budget_estimated" IS NULL) OR ("budget_estimated" >= (0)::numeric))),
    CONSTRAINT "chk_program_dates" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "chk_program_ended" CHECK (((("state" = 'ENDED'::"public"."entity_state") AND ("end_date" IS NOT NULL)) OR ("state" = 'ACTIVE'::"public"."entity_state"))),
    CONSTRAINT "chk_program_version" CHECK (("version" >= 1))
);

ALTER TABLE ONLY "public"."program" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."program" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "objective" "text",
    "program_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "state" "public"."entity_state" DEFAULT 'ACTIVE'::"public"."entity_state" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "budget_estimated" numeric(12,2),
    "created_by_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "progress" smallint DEFAULT 0 NOT NULL,
    "activity_id" "uuid",
    "theme_id" "uuid",
    "category_id" "uuid",
    "project_code" "text",
    CONSTRAINT "chk_project_budget" CHECK ((("budget_estimated" IS NULL) OR ("budget_estimated" >= (0)::numeric))),
    CONSTRAINT "chk_project_dates" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "chk_project_ended" CHECK (((("state" = 'ENDED'::"public"."entity_state") AND ("end_date" IS NOT NULL)) OR ("state" = 'ACTIVE'::"public"."entity_state"))),
    CONSTRAINT "chk_project_version" CHECK (("version" >= 1)),
    CONSTRAINT "project_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100)))
);

ALTER TABLE ONLY "public"."project" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."project" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_member" (
    "project_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "role" "public"."project_role" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);

ALTER TABLE ONLY "public"."project_member" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_member" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "review_date" "date" NOT NULL,
    "notes" "text" NOT NULL,
    "created_by_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "version" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."review" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "objective" character varying(255) NOT NULL,
    "details" "text",
    "project_id" "uuid" NOT NULL,
    "priority" "public"."task_priority" DEFAULT 'NORMAL'::"public"."task_priority" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "state" "public"."entity_state" DEFAULT 'ACTIVE'::"public"."entity_state" NOT NULL,
    "task_order" integer DEFAULT 0 NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "budget_estimated" numeric(12,2),
    "created_by_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "progress" smallint DEFAULT 0 NOT NULL,
    "owner_id" "uuid",
    CONSTRAINT "chk_task_budget" CHECK ((("budget_estimated" IS NULL) OR ("budget_estimated" >= (0)::numeric))),
    CONSTRAINT "chk_task_dates" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "chk_task_ended" CHECK (((("state" = 'ENDED'::"public"."entity_state") AND ("end_date" IS NOT NULL)) OR ("state" = 'ACTIVE'::"public"."entity_state"))),
    CONSTRAINT "chk_task_version" CHECK (("version" >= 1)),
    CONSTRAINT "task_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100)))
);

ALTER TABLE ONLY "public"."task" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."task" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."theme" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "code" character varying(50) NOT NULL
);

ALTER TABLE ONLY "public"."theme" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."theme" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "hours" numeric(5,2) NOT NULL,
    "hourly_rate" numeric(8,2),
    "description" "text",
    "work_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "chk_time_entry_hours" CHECK (("hours" > (0)::numeric)),
    CONSTRAINT "chk_time_entry_rate" CHECK ((("hourly_rate" IS NULL) OR ("hourly_rate" >= (0)::numeric)))
);

ALTER TABLE ONLY "public"."time_entry" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "todo_order" integer DEFAULT 0 NOT NULL,
    "action" "text" NOT NULL,
    "delivery_date" "date",
    "responsible_id" "uuid",
    "comments" "text",
    "created_by_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "status" "public"."todo_status" DEFAULT 'ACTIVE'::"public"."todo_status" NOT NULL,
    CONSTRAINT "chk_todo_version" CHECK (("version" >= 1))
);

ALTER TABLE ONLY "public"."todo" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."actor"
    ADD CONSTRAINT "actor_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."actor"
    ADD CONSTRAINT "actor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attachment"
    ADD CONSTRAINT "attachment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category"
    ADD CONSTRAINT "category_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."category"
    ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable"
    ADD CONSTRAINT "deliverable_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_member"
    ADD CONSTRAINT "project_member_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_member"
    ADD CONSTRAINT "project_member_project_id_actor_id_key" UNIQUE ("project_id", "actor_id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review"
    ADD CONSTRAINT "review_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task"
    ADD CONSTRAINT "task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."theme"
    ADD CONSTRAINT "theme_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."theme"
    ADD CONSTRAINT "theme_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entry"
    ADD CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo"
    ADD CONSTRAINT "todo_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_actor_email" ON "public"."actor" USING "btree" ("email");



CREATE INDEX "idx_actor_is_active" ON "public"."actor" USING "btree" ("is_active") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_actor_system_role" ON "public"."actor" USING "btree" ("system_role");



CREATE INDEX "idx_attachment_deliverable" ON "public"."attachment" USING "btree" ("deliverable_id");



CREATE INDEX "idx_attachment_uploaded_by" ON "public"."attachment" USING "btree" ("uploaded_by_id");



CREATE INDEX "idx_audit_actor" ON "public"."audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_created" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_project_id" ON "public"."audit_log" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "idx_audit_record" ON "public"."audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_task_id" ON "public"."audit_log" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "idx_deliverable_created_by" ON "public"."deliverable" USING "btree" ("created_by_id");



CREATE INDEX "idx_deliverable_task" ON "public"."deliverable" USING "btree" ("task_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_program_created_by" ON "public"."program" USING "btree" ("created_by_id");



CREATE INDEX "idx_program_state" ON "public"."program" USING "btree" ("state") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "idx_project_code" ON "public"."project" USING "btree" ("project_code") WHERE ("project_code" IS NOT NULL);



CREATE INDEX "idx_project_created_by" ON "public"."project" USING "btree" ("created_by_id");



CREATE INDEX "idx_project_member_actor" ON "public"."project_member" USING "btree" ("actor_id");



CREATE INDEX "idx_project_member_role" ON "public"."project_member" USING "btree" ("project_id", "role");



CREATE INDEX "idx_project_program" ON "public"."project" USING "btree" ("program_id");



CREATE INDEX "idx_project_state" ON "public"."project" USING "btree" ("state") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_review_date" ON "public"."review" USING "btree" ("project_id", "review_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_review_project" ON "public"."review" USING "btree" ("project_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_task_created_by" ON "public"."task" USING "btree" ("created_by_id");



CREATE INDEX "idx_task_order" ON "public"."task" USING "btree" ("project_id", "task_order");



CREATE INDEX "idx_task_owner" ON "public"."task" USING "btree" ("owner_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_task_priority" ON "public"."task" USING "btree" ("project_id", "priority");



CREATE INDEX "idx_task_project" ON "public"."task" USING "btree" ("project_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_task_state" ON "public"."task" USING "btree" ("project_id", "state") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_time_entry_actor" ON "public"."time_entry" USING "btree" ("actor_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_time_entry_task" ON "public"."time_entry" USING "btree" ("task_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_time_entry_task_actor" ON "public"."time_entry" USING "btree" ("task_id", "actor_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_time_entry_work_date" ON "public"."time_entry" USING "btree" ("work_date");



CREATE INDEX "idx_todo_created_by" ON "public"."todo" USING "btree" ("created_by_id");



CREATE UNIQUE INDEX "idx_todo_project_order" ON "public"."todo" USING "btree" ("project_id", "todo_order") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_todo_responsible" ON "public"."todo" USING "btree" ("responsible_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "project_activity_id_idx" ON "public"."project" USING "btree" ("activity_id");



CREATE INDEX "project_category_id_idx" ON "public"."project" USING "btree" ("category_id");



CREATE INDEX "project_theme_id_idx" ON "public"."project" USING "btree" ("theme_id");



CREATE OR REPLACE TRIGGER "trg_actor_updated_at" BEFORE UPDATE ON "public"."actor" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_audit_attachment" AFTER INSERT OR DELETE ON "public"."attachment" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_deliverable" AFTER INSERT OR DELETE OR UPDATE ON "public"."deliverable" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_program" AFTER INSERT OR DELETE OR UPDATE ON "public"."program" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_project" AFTER INSERT OR DELETE OR UPDATE ON "public"."project" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_project_member" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_member" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_review" AFTER INSERT OR DELETE OR UPDATE ON "public"."review" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_task" AFTER INSERT OR DELETE OR UPDATE ON "public"."task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_todo" AFTER INSERT OR DELETE OR UPDATE ON "public"."todo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit"();



CREATE OR REPLACE TRIGGER "trg_cascade_soft_delete_deliverable" AFTER UPDATE ON "public"."deliverable" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cascade_soft_delete_deliverable"();



CREATE OR REPLACE TRIGGER "trg_cascade_soft_delete_program" AFTER UPDATE ON "public"."program" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cascade_soft_delete_program"();



CREATE OR REPLACE TRIGGER "trg_cascade_soft_delete_project" AFTER UPDATE ON "public"."project" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cascade_soft_delete_project"();



CREATE OR REPLACE TRIGGER "trg_cascade_soft_delete_task" AFTER UPDATE ON "public"."task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cascade_soft_delete_task"();



CREATE OR REPLACE TRIGGER "trg_deliverable_modified_at" BEFORE UPDATE ON "public"."deliverable" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_modified_at"();



CREATE OR REPLACE TRIGGER "trg_program_modified_at" BEFORE UPDATE ON "public"."program" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_modified_at"();



CREATE OR REPLACE TRIGGER "trg_project_modified_at" BEFORE UPDATE ON "public"."project" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_modified_at"();



CREATE OR REPLACE TRIGGER "trg_task_modified_at" BEFORE UPDATE ON "public"."task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_modified_at"();



CREATE OR REPLACE TRIGGER "trg_time_entry_modified_at" BEFORE UPDATE ON "public"."time_entry" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_modified_at"();



CREATE OR REPLACE TRIGGER "trg_todo_modified_at" BEFORE UPDATE ON "public"."todo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_modified_at"();



ALTER TABLE ONLY "public"."attachment"
    ADD CONSTRAINT "attachment_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverable"("id");



ALTER TABLE ONLY "public"."attachment"
    ADD CONSTRAINT "attachment_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id");



ALTER TABLE ONLY "public"."deliverable"
    ADD CONSTRAINT "deliverable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."deliverable"
    ADD CONSTRAINT "deliverable_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id");



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."project_member"
    ADD CONSTRAINT "project_member_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."project_member"
    ADD CONSTRAINT "project_member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review"
    ADD CONSTRAINT "review_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."review"
    ADD CONSTRAINT "review_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id");



ALTER TABLE ONLY "public"."task"
    ADD CONSTRAINT "task_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."task"
    ADD CONSTRAINT "task_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."task"
    ADD CONSTRAINT "task_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id");



ALTER TABLE ONLY "public"."time_entry"
    ADD CONSTRAINT "time_entry_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."time_entry"
    ADD CONSTRAINT "time_entry_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id");



ALTER TABLE ONLY "public"."todo"
    ADD CONSTRAINT "todo_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."actor"("id");



ALTER TABLE ONLY "public"."todo"
    ADD CONSTRAINT "todo_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id");



ALTER TABLE ONLY "public"."todo"
    ADD CONSTRAINT "todo_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."actor"("id");



ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_insert" ON "public"."activity" FOR INSERT WITH CHECK ("public"."app_is_admin"());



CREATE POLICY "activity_select" ON "public"."activity" FOR SELECT USING (("public"."app_actor_id"() IS NOT NULL));



CREATE POLICY "activity_update" ON "public"."activity" FOR UPDATE USING ("public"."app_is_admin"());



ALTER TABLE "public"."actor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "actor_insert" ON "public"."actor" FOR INSERT WITH CHECK (true);



CREATE POLICY "actor_select" ON "public"."actor" FOR SELECT USING (true);



CREATE POLICY "actor_update" ON "public"."actor" FOR UPDATE USING (("public"."app_is_admin"() OR ("id" = "public"."app_actor_id"())));



ALTER TABLE "public"."attachment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attachment_delete" ON "public"."attachment" FOR DELETE USING (("public"."app_is_admin"() OR ("uploaded_by_id" = "public"."app_actor_id"()) OR (EXISTS ( SELECT 1
   FROM ("public"."deliverable" "d"
     JOIN "public"."task" "t" ON (("t"."id" = "d"."task_id")))
  WHERE (("d"."id" = "attachment"."deliverable_id") AND "public"."app_has_min_role"("t"."project_id", 'MANAGER'::"public"."project_role"))))));



CREATE POLICY "attachment_insert" ON "public"."attachment" FOR INSERT WITH CHECK (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."deliverable" "d"
     JOIN "public"."task" "t" ON (("t"."id" = "d"."task_id")))
  WHERE (("d"."id" = "attachment"."deliverable_id") AND "public"."app_is_project_member"("t"."project_id"))))));



CREATE POLICY "attachment_select" ON "public"."attachment" FOR SELECT USING (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."deliverable" "d"
     JOIN "public"."task" "t" ON (("t"."id" = "d"."task_id")))
  WHERE (("d"."id" = "attachment"."deliverable_id") AND "public"."app_is_project_member"("t"."project_id"))))));



CREATE POLICY "attachment_update" ON "public"."attachment" FOR UPDATE USING (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."deliverable" "d"
     JOIN "public"."task" "t" ON (("t"."id" = "d"."task_id")))
  WHERE (("d"."id" = "attachment"."deliverable_id") AND "public"."app_has_min_role"("t"."project_id", 'MANAGER'::"public"."project_role"))))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select" ON "public"."audit_log" FOR SELECT USING (("public"."app_is_admin"() OR (("project_id" IS NOT NULL) AND "public"."app_is_project_member"("project_id"))));



ALTER TABLE "public"."category" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_insert" ON "public"."category" FOR INSERT WITH CHECK ("public"."app_is_admin"());



CREATE POLICY "category_select" ON "public"."category" FOR SELECT USING (("public"."app_actor_id"() IS NOT NULL));



CREATE POLICY "category_update" ON "public"."category" FOR UPDATE USING ("public"."app_is_admin"());



ALTER TABLE "public"."deliverable" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deliverable_insert" ON "public"."deliverable" FOR INSERT WITH CHECK (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."task" "t"
  WHERE (("t"."id" = "deliverable"."task_id") AND "public"."app_has_min_role"("t"."project_id", 'MANAGER'::"public"."project_role"))))));



CREATE POLICY "deliverable_select" ON "public"."deliverable" FOR SELECT USING (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."task" "t"
  WHERE (("t"."id" = "deliverable"."task_id") AND "public"."app_is_project_member"("t"."project_id"))))));



CREATE POLICY "deliverable_update" ON "public"."deliverable" FOR UPDATE USING (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."task" "t"
  WHERE (("t"."id" = "deliverable"."task_id") AND "public"."app_has_min_role"("t"."project_id", 'MANAGER'::"public"."project_role"))))));



ALTER TABLE "public"."program" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "program_insert" ON "public"."program" FOR INSERT WITH CHECK ("public"."app_is_admin"());



CREATE POLICY "program_select" ON "public"."program" FOR SELECT USING (("public"."app_is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."project" "p"
     JOIN "public"."project_member" "pm" ON (("pm"."project_id" = "p"."id")))
  WHERE (("p"."program_id" = "program"."id") AND ("pm"."actor_id" = "public"."app_actor_id"()) AND ("pm"."deleted_at" IS NULL))))));



CREATE POLICY "program_update" ON "public"."program" FOR UPDATE USING ("public"."app_is_admin"());



ALTER TABLE "public"."project" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_insert" ON "public"."project" FOR INSERT WITH CHECK ("public"."app_is_admin"());



ALTER TABLE "public"."project_member" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_member_delete" ON "public"."project_member" FOR DELETE USING (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'DIRECTOR'::"public"."project_role")));



CREATE POLICY "project_member_insert" ON "public"."project_member" FOR INSERT WITH CHECK (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'MANAGER'::"public"."project_role")));



CREATE POLICY "project_member_select" ON "public"."project_member" FOR SELECT USING (("public"."app_is_admin"() OR "public"."app_is_project_member"("project_id")));



CREATE POLICY "project_member_update" ON "public"."project_member" FOR UPDATE USING (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'MANAGER'::"public"."project_role")));



CREATE POLICY "project_select" ON "public"."project" FOR SELECT USING (("public"."app_is_admin"() OR "public"."app_is_project_member"("id")));



CREATE POLICY "project_update" ON "public"."project" FOR UPDATE USING (("public"."app_is_admin"() OR "public"."app_has_min_role"("id", 'DIRECTOR'::"public"."project_role")));



ALTER TABLE "public"."review" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_insert" ON "public"."review" FOR INSERT TO "ppm_app" WITH CHECK ((("current_setting"('app.system_role'::"text", true) = 'ADMIN'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."project_member" "pm"
  WHERE (("pm"."project_id" = "review"."project_id") AND ("pm"."actor_id" = "public"."app_actor_id"()) AND ("pm"."deleted_at" IS NULL) AND ("pm"."role" = ANY (ARRAY['DIRECTOR'::"public"."project_role", 'MANAGER'::"public"."project_role"])))))));



CREATE POLICY "review_select" ON "public"."review" FOR SELECT TO "ppm_app" USING ((("deleted_at" IS NULL) AND (("current_setting"('app.system_role'::"text", true) = 'ADMIN'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."project_member" "pm"
  WHERE (("pm"."project_id" = "review"."project_id") AND ("pm"."actor_id" = "public"."app_actor_id"()) AND ("pm"."deleted_at" IS NULL)))))));



CREATE POLICY "review_update" ON "public"."review" FOR UPDATE TO "ppm_app" USING ((("deleted_at" IS NULL) AND (("current_setting"('app.system_role'::"text", true) = 'ADMIN'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."project_member" "pm"
  WHERE (("pm"."project_id" = "review"."project_id") AND ("pm"."actor_id" = "public"."app_actor_id"()) AND ("pm"."deleted_at" IS NULL) AND ("pm"."role" = ANY (ARRAY['DIRECTOR'::"public"."project_role", 'MANAGER'::"public"."project_role"]))))))));



ALTER TABLE "public"."task" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_insert" ON "public"."task" FOR INSERT WITH CHECK (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'MANAGER'::"public"."project_role")));



CREATE POLICY "task_select" ON "public"."task" FOR SELECT USING (("public"."app_is_admin"() OR "public"."app_is_project_member"("project_id")));



CREATE POLICY "task_update" ON "public"."task" FOR UPDATE USING (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'MANAGER'::"public"."project_role")));



ALTER TABLE "public"."theme" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "theme_insert" ON "public"."theme" FOR INSERT WITH CHECK ("public"."app_is_admin"());



CREATE POLICY "theme_select" ON "public"."theme" FOR SELECT USING (("public"."app_actor_id"() IS NOT NULL));



CREATE POLICY "theme_update" ON "public"."theme" FOR UPDATE USING ("public"."app_is_admin"());



ALTER TABLE "public"."time_entry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_entry_insert" ON "public"."time_entry" FOR INSERT WITH CHECK (("public"."app_is_admin"() OR ("actor_id" = "public"."app_actor_id"())));



CREATE POLICY "time_entry_select" ON "public"."time_entry" FOR SELECT USING (("public"."app_is_admin"() OR ("actor_id" = "public"."app_actor_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."task" "t"
  WHERE (("t"."id" = "time_entry"."task_id") AND "public"."app_has_min_role"("t"."project_id", 'MANAGER'::"public"."project_role"))))));



CREATE POLICY "time_entry_update" ON "public"."time_entry" FOR UPDATE USING (("public"."app_is_admin"() OR ("actor_id" = "public"."app_actor_id"())));



ALTER TABLE "public"."todo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "todo_insert" ON "public"."todo" FOR INSERT WITH CHECK (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'MANAGER'::"public"."project_role")));



CREATE POLICY "todo_select" ON "public"."todo" FOR SELECT USING (("public"."app_is_admin"() OR "public"."app_is_project_member"("project_id")));



CREATE POLICY "todo_update" ON "public"."todo" FOR UPDATE USING (("public"."app_is_admin"() OR "public"."app_has_min_role"("project_id", 'MANAGER'::"public"."project_role")));



GRANT USAGE ON SCHEMA "public" TO "ppm_app";



GRANT ALL ON TYPE "public"."todo_status" TO "ppm_app";


















GRANT ALL ON FUNCTION "public"."fn_cascade_soft_delete_deliverable"() TO "ppm_app";



GRANT ALL ON FUNCTION "public"."fn_cascade_soft_delete_program"() TO "ppm_app";



GRANT ALL ON FUNCTION "public"."fn_cascade_soft_delete_project"() TO "ppm_app";



GRANT ALL ON FUNCTION "public"."fn_cascade_soft_delete_task"() TO "ppm_app";









GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."actor" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."attachment" TO "ppm_app";



GRANT SELECT ON TABLE "public"."audit_log" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."category" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."deliverable" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."program" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project" TO "ppm_app";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."project_member" TO "ppm_app";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."review" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."task" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."theme" TO "ppm_app";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."time_entry" TO "ppm_app";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."todo" TO "ppm_app";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "ppm_app";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,UPDATE ON TABLES TO "ppm_app";







