--
-- PostgreSQL database dump
--

\restrict 9ndFf2o64wnsOOtM7NUYlf2Zy2b7wNTSnPxO3HxQeLyA7jSeq0iSyhTwoAGtwBw

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: audit_action; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.audit_action AS ENUM (
    'CREATE',
    'UPDATE',
    'END',
    'DELETE'
);


ALTER TYPE public.audit_action OWNER TO postgres;

--
-- Name: entity_state; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.entity_state AS ENUM (
    'ACTIVE',
    'ENDED',
    'WAITING',
    'CANCELED'
);


ALTER TYPE public.entity_state OWNER TO postgres;

--
-- Name: project_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_role AS ENUM (
    'DIRECTOR',
    'MANAGER',
    'CONTRIBUTOR'
);


ALTER TYPE public.project_role OWNER TO postgres;

--
-- Name: system_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.system_role AS ENUM (
    'ADMIN',
    'USER'
);


ALTER TYPE public.system_role OWNER TO postgres;

--
-- Name: task_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_priority AS ENUM (
    'LOW',
    'NORMAL',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public.task_priority OWNER TO postgres;

--
-- Name: todo_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.todo_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.todo_status OWNER TO postgres;

--
-- Name: app_actor_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.app_actor_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::UUID;
$$;


ALTER FUNCTION public.app_actor_id() OWNER TO postgres;

--
-- Name: app_has_min_role(uuid, public.project_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.app_has_min_role(p_project_id uuid, p_min_role public.project_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
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


ALTER FUNCTION public.app_has_min_role(p_project_id uuid, p_min_role public.project_role) OWNER TO postgres;

--
-- Name: app_is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.app_is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT current_setting('app.system_role', true) = 'ADMIN';
$$;


ALTER FUNCTION public.app_is_admin() OWNER TO postgres;

--
-- Name: app_is_project_member(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.app_is_project_member(p_project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_member
    WHERE project_id = p_project_id
      AND actor_id = app_actor_id()
      AND deleted_at IS NULL
  );
$$;


ALTER FUNCTION public.app_is_project_member(p_project_id uuid) OWNER TO postgres;

--
-- Name: fn_audit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.fn_audit() OWNER TO postgres;

--
-- Name: fn_cascade_soft_delete_deliverable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cascade_soft_delete_deliverable() RETURNS trigger
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_cascade_soft_delete_deliverable() OWNER TO postgres;

--
-- Name: fn_cascade_soft_delete_program(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cascade_soft_delete_program() RETURNS trigger
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_cascade_soft_delete_program() OWNER TO postgres;

--
-- Name: fn_cascade_soft_delete_project(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cascade_soft_delete_project() RETURNS trigger
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_cascade_soft_delete_project() OWNER TO postgres;

--
-- Name: fn_cascade_soft_delete_task(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cascade_soft_delete_task() RETURNS trigger
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_cascade_soft_delete_task() OWNER TO postgres;

--
-- Name: fn_update_modified_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_modified_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.modified_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_update_modified_at() OWNER TO postgres;

--
-- Name: fn_update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_update_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    code character varying(50) NOT NULL
);

ALTER TABLE ONLY public.activity FORCE ROW LEVEL SECURITY;


ALTER TABLE public.activity OWNER TO postgres;

--
-- Name: actor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    system_role public.system_role DEFAULT 'USER'::public.system_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    from_ad boolean DEFAULT false NOT NULL,
    hourly_rate numeric(8,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

ALTER TABLE ONLY public.actor FORCE ROW LEVEL SECURITY;


ALTER TABLE public.actor OWNER TO postgres;

--
-- Name: attachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attachment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deliverable_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    file_url text,
    file_type character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_size integer,
    uploaded_by_id uuid
);

ALTER TABLE ONLY public.attachment FORCE ROW LEVEL SECURITY;


ALTER TABLE public.attachment OWNER TO postgres;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action public.audit_action NOT NULL,
    project_id uuid,
    task_id uuid,
    old_data jsonb,
    new_data jsonb,
    changed_fields jsonb,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    code character varying(50) NOT NULL
);

ALTER TABLE ONLY public.category FORCE ROW LEVEL SECURITY;


ALTER TABLE public.category OWNER TO postgres;

--
-- Name: deliverable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deliverable (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100),
    task_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_deliverable_version CHECK ((version >= 1))
);

ALTER TABLE ONLY public.deliverable FORCE ROW LEVEL SECURITY;


ALTER TABLE public.deliverable OWNER TO postgres;

--
-- Name: program; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.program (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    state public.entity_state DEFAULT 'ACTIVE'::public.entity_state NOT NULL,
    start_date date NOT NULL,
    end_date date,
    budget_estimated numeric(12,2),
    currency character varying(3) DEFAULT 'EUR'::character varying,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_program_budget CHECK (((budget_estimated IS NULL) OR (budget_estimated >= (0)::numeric))),
    CONSTRAINT chk_program_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_program_ended CHECK (((state = ANY (ARRAY['ACTIVE'::public.entity_state, 'WAITING'::public.entity_state])) OR ((state = ANY (ARRAY['ENDED'::public.entity_state, 'CANCELED'::public.entity_state])) AND (end_date IS NOT NULL)))),
    CONSTRAINT chk_program_version CHECK ((version >= 1))
);

ALTER TABLE ONLY public.program FORCE ROW LEVEL SECURITY;


ALTER TABLE public.program OWNER TO postgres;

--
-- Name: project; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    objective text,
    program_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    state public.entity_state DEFAULT 'ACTIVE'::public.entity_state NOT NULL,
    start_date date NOT NULL,
    end_date date,
    budget_estimated numeric(12,2),
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    progress smallint DEFAULT 0 NOT NULL,
    activity_id uuid,
    theme_id uuid,
    category_id uuid,
    project_code text,
    CONSTRAINT chk_project_budget CHECK (((budget_estimated IS NULL) OR (budget_estimated >= (0)::numeric))),
    CONSTRAINT chk_project_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_project_ended CHECK (((state = ANY (ARRAY['ACTIVE'::public.entity_state, 'WAITING'::public.entity_state])) OR ((state = ANY (ARRAY['ENDED'::public.entity_state, 'CANCELED'::public.entity_state])) AND (end_date IS NOT NULL)))),
    CONSTRAINT chk_project_version CHECK ((version >= 1)),
    CONSTRAINT project_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);

ALTER TABLE ONLY public.project FORCE ROW LEVEL SECURITY;


ALTER TABLE public.project OWNER TO postgres;

--
-- Name: project_member; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_member (
    project_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    role public.project_role NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);

ALTER TABLE ONLY public.project_member FORCE ROW LEVEL SECURITY;


ALTER TABLE public.project_member OWNER TO postgres;

--
-- Name: review; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.review (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    review_date date NOT NULL,
    notes text NOT NULL,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.review OWNER TO postgres;

--
-- Name: task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    objective character varying(255) NOT NULL,
    details text,
    project_id uuid NOT NULL,
    priority public.task_priority DEFAULT 'NORMAL'::public.task_priority NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    state public.entity_state DEFAULT 'ACTIVE'::public.entity_state NOT NULL,
    task_order integer DEFAULT 0 NOT NULL,
    start_date date NOT NULL,
    end_date date,
    budget_estimated numeric(12,2),
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    progress smallint DEFAULT 0 NOT NULL,
    owner_id uuid,
    CONSTRAINT chk_task_budget CHECK (((budget_estimated IS NULL) OR (budget_estimated >= (0)::numeric))),
    CONSTRAINT chk_task_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_task_ended CHECK (((state = ANY (ARRAY['ACTIVE'::public.entity_state, 'WAITING'::public.entity_state])) OR ((state = ANY (ARRAY['ENDED'::public.entity_state, 'CANCELED'::public.entity_state])) AND (end_date IS NOT NULL)))),
    CONSTRAINT chk_task_version CHECK ((version >= 1)),
    CONSTRAINT task_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);

ALTER TABLE ONLY public.task FORCE ROW LEVEL SECURITY;


ALTER TABLE public.task OWNER TO postgres;

--
-- Name: theme; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.theme (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    code character varying(50) NOT NULL
);

ALTER TABLE ONLY public.theme FORCE ROW LEVEL SECURITY;


ALTER TABLE public.theme OWNER TO postgres;

--
-- Name: time_entry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    hours numeric(5,2) NOT NULL,
    hourly_rate numeric(8,2),
    description text,
    work_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_time_entry_hours CHECK ((hours > (0)::numeric)),
    CONSTRAINT chk_time_entry_rate CHECK (((hourly_rate IS NULL) OR (hourly_rate >= (0)::numeric)))
);

ALTER TABLE ONLY public.time_entry FORCE ROW LEVEL SECURITY;


ALTER TABLE public.time_entry OWNER TO postgres;

--
-- Name: todo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.todo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    todo_order integer DEFAULT 0 NOT NULL,
    action text NOT NULL,
    delivery_date date,
    responsible_id uuid,
    comments text,
    created_by_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    status public.todo_status DEFAULT 'ACTIVE'::public.todo_status NOT NULL,
    CONSTRAINT chk_todo_version CHECK ((version >= 1))
);

ALTER TABLE ONLY public.todo FORCE ROW LEVEL SECURITY;


ALTER TABLE public.todo OWNER TO postgres;

--
-- Name: activity activity_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_code_key UNIQUE (code);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (id);


--
-- Name: actor actor_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actor
    ADD CONSTRAINT actor_email_key UNIQUE (email);


--
-- Name: actor actor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actor
    ADD CONSTRAINT actor_pkey PRIMARY KEY (id);


--
-- Name: attachment attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: category category_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_code_key UNIQUE (code);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: deliverable deliverable_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverable
    ADD CONSTRAINT deliverable_pkey PRIMARY KEY (id);


--
-- Name: program program_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_pkey PRIMARY KEY (id);


--
-- Name: project_member project_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_pkey PRIMARY KEY (id);


--
-- Name: project_member project_member_project_id_actor_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_project_id_actor_id_key UNIQUE (project_id, actor_id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: review review_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review
    ADD CONSTRAINT review_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: theme theme_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.theme
    ADD CONSTRAINT theme_code_key UNIQUE (code);


--
-- Name: theme theme_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.theme
    ADD CONSTRAINT theme_pkey PRIMARY KEY (id);


--
-- Name: time_entry time_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entry
    ADD CONSTRAINT time_entry_pkey PRIMARY KEY (id);


--
-- Name: todo todo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_pkey PRIMARY KEY (id);


--
-- Name: idx_actor_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actor_email ON public.actor USING btree (email);


--
-- Name: idx_actor_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actor_is_active ON public.actor USING btree (is_active) WHERE (deleted_at IS NULL);


--
-- Name: idx_actor_system_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actor_system_role ON public.actor USING btree (system_role);


--
-- Name: idx_attachment_deliverable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attachment_deliverable ON public.attachment USING btree (deliverable_id);


--
-- Name: idx_attachment_uploaded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attachment_uploaded_by ON public.attachment USING btree (uploaded_by_id);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_actor ON public.audit_log USING btree (actor_id);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_project_id ON public.audit_log USING btree (project_id, created_at DESC);


--
-- Name: idx_audit_record; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_record ON public.audit_log USING btree (table_name, record_id);


--
-- Name: idx_audit_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_task_id ON public.audit_log USING btree (task_id, created_at DESC);


--
-- Name: idx_deliverable_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliverable_created_by ON public.deliverable USING btree (created_by_id);


--
-- Name: idx_deliverable_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliverable_task ON public.deliverable USING btree (task_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_program_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_program_created_by ON public.program USING btree (created_by_id);


--
-- Name: idx_program_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_program_state ON public.program USING btree (state) WHERE (deleted_at IS NULL);


--
-- Name: idx_project_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_project_code ON public.project USING btree (project_code) WHERE (project_code IS NOT NULL);


--
-- Name: idx_project_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_created_by ON public.project USING btree (created_by_id);


--
-- Name: idx_project_member_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_member_actor ON public.project_member USING btree (actor_id);


--
-- Name: idx_project_member_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_member_role ON public.project_member USING btree (project_id, role);


--
-- Name: idx_project_program; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_program ON public.project USING btree (program_id);


--
-- Name: idx_project_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_state ON public.project USING btree (state) WHERE (deleted_at IS NULL);


--
-- Name: idx_review_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_date ON public.review USING btree (project_id, review_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_review_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_project ON public.review USING btree (project_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_task_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_created_by ON public.task USING btree (created_by_id);


--
-- Name: idx_task_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_order ON public.task USING btree (project_id, task_order);


--
-- Name: idx_task_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_owner ON public.task USING btree (owner_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_task_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_priority ON public.task USING btree (project_id, priority);


--
-- Name: idx_task_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_project ON public.task USING btree (project_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_task_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_state ON public.task USING btree (project_id, state) WHERE (deleted_at IS NULL);


--
-- Name: idx_time_entry_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_entry_actor ON public.time_entry USING btree (actor_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_time_entry_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_entry_task ON public.time_entry USING btree (task_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_time_entry_task_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_entry_task_actor ON public.time_entry USING btree (task_id, actor_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_time_entry_work_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_entry_work_date ON public.time_entry USING btree (work_date);


--
-- Name: idx_todo_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_todo_created_by ON public.todo USING btree (created_by_id);


--
-- Name: idx_todo_project_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_todo_project_order ON public.todo USING btree (project_id, todo_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_todo_responsible; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_todo_responsible ON public.todo USING btree (responsible_id) WHERE (deleted_at IS NULL);


--
-- Name: project_activity_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_activity_id_idx ON public.project USING btree (activity_id);


--
-- Name: project_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_category_id_idx ON public.project USING btree (category_id);


--
-- Name: project_theme_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_theme_id_idx ON public.project USING btree (theme_id);


--
-- Name: actor trg_actor_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_actor_updated_at BEFORE UPDATE ON public.actor FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();


--
-- Name: attachment trg_audit_attachment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_attachment AFTER INSERT OR DELETE ON public.attachment FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: deliverable trg_audit_deliverable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_deliverable AFTER INSERT OR DELETE OR UPDATE ON public.deliverable FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: program trg_audit_program; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_program AFTER INSERT OR DELETE OR UPDATE ON public.program FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: project trg_audit_project; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_project AFTER INSERT OR DELETE OR UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: project_member trg_audit_project_member; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_project_member AFTER INSERT OR DELETE OR UPDATE ON public.project_member FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: review trg_audit_review; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_review AFTER INSERT OR DELETE OR UPDATE ON public.review FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: task trg_audit_task; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_task AFTER INSERT OR DELETE OR UPDATE ON public.task FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: todo trg_audit_todo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_todo AFTER INSERT OR DELETE OR UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


--
-- Name: deliverable trg_cascade_soft_delete_deliverable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cascade_soft_delete_deliverable AFTER UPDATE ON public.deliverable FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_soft_delete_deliverable();


--
-- Name: program trg_cascade_soft_delete_program; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cascade_soft_delete_program AFTER UPDATE ON public.program FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_soft_delete_program();


--
-- Name: project trg_cascade_soft_delete_project; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cascade_soft_delete_project AFTER UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_soft_delete_project();


--
-- Name: task trg_cascade_soft_delete_task; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cascade_soft_delete_task AFTER UPDATE ON public.task FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_soft_delete_task();


--
-- Name: deliverable trg_deliverable_modified_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_deliverable_modified_at BEFORE UPDATE ON public.deliverable FOR EACH ROW EXECUTE FUNCTION public.fn_update_modified_at();


--
-- Name: program trg_program_modified_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_program_modified_at BEFORE UPDATE ON public.program FOR EACH ROW EXECUTE FUNCTION public.fn_update_modified_at();


--
-- Name: project trg_project_modified_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_project_modified_at BEFORE UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.fn_update_modified_at();


--
-- Name: task trg_task_modified_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_task_modified_at BEFORE UPDATE ON public.task FOR EACH ROW EXECUTE FUNCTION public.fn_update_modified_at();


--
-- Name: time_entry trg_time_entry_modified_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_time_entry_modified_at BEFORE UPDATE ON public.time_entry FOR EACH ROW EXECUTE FUNCTION public.fn_update_modified_at();


--
-- Name: todo trg_todo_modified_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_todo_modified_at BEFORE UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.fn_update_modified_at();


--
-- Name: attachment attachment_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverable(id);


--
-- Name: attachment attachment_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.actor(id);


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actor(id);


--
-- Name: audit_log audit_log_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: audit_log audit_log_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id);


--
-- Name: deliverable deliverable_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverable
    ADD CONSTRAINT deliverable_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.actor(id);


--
-- Name: deliverable deliverable_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverable
    ADD CONSTRAINT deliverable_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id);


--
-- Name: program program_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.actor(id);


--
-- Name: project project_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: project project_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: project project_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.actor(id);


--
-- Name: project_member project_member_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actor(id);


--
-- Name: project_member project_member_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member
    ADD CONSTRAINT project_member_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: project project_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(id);


--
-- Name: project project_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.theme(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: review review_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review
    ADD CONSTRAINT review_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.actor(id);


--
-- Name: review review_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review
    ADD CONSTRAINT review_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: task task_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.actor(id);


--
-- Name: task task_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.actor(id);


--
-- Name: task task_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: time_entry time_entry_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entry
    ADD CONSTRAINT time_entry_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actor(id);


--
-- Name: time_entry time_entry_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entry
    ADD CONSTRAINT time_entry_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id);


--
-- Name: todo todo_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.actor(id);


--
-- Name: todo todo_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: todo todo_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.actor(id);


--
-- Name: activity; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

--
-- Name: activity activity_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY activity_insert ON public.activity FOR INSERT WITH CHECK (public.app_is_admin());


--
-- Name: activity activity_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY activity_select ON public.activity FOR SELECT USING ((public.app_actor_id() IS NOT NULL));


--
-- Name: activity activity_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY activity_update ON public.activity FOR UPDATE USING (public.app_is_admin());


--
-- Name: actor; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.actor ENABLE ROW LEVEL SECURITY;

--
-- Name: actor actor_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY actor_insert ON public.actor FOR INSERT WITH CHECK (true);


--
-- Name: actor actor_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY actor_select ON public.actor FOR SELECT USING (true);


--
-- Name: actor actor_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY actor_update ON public.actor FOR UPDATE USING ((public.app_is_admin() OR (id = public.app_actor_id())));


--
-- Name: attachment; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attachment ENABLE ROW LEVEL SECURITY;

--
-- Name: attachment attachment_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attachment_delete ON public.attachment FOR DELETE USING ((public.app_is_admin() OR (uploaded_by_id = public.app_actor_id()) OR (EXISTS ( SELECT 1
   FROM (public.deliverable d
     JOIN public.task t ON ((t.id = d.task_id)))
  WHERE ((d.id = attachment.deliverable_id) AND public.app_has_min_role(t.project_id, 'MANAGER'::public.project_role))))));


--
-- Name: attachment attachment_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attachment_insert ON public.attachment FOR INSERT WITH CHECK ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM (public.deliverable d
     JOIN public.task t ON ((t.id = d.task_id)))
  WHERE ((d.id = attachment.deliverable_id) AND public.app_is_project_member(t.project_id))))));


--
-- Name: attachment attachment_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attachment_select ON public.attachment FOR SELECT USING ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM (public.deliverable d
     JOIN public.task t ON ((t.id = d.task_id)))
  WHERE ((d.id = attachment.deliverable_id) AND public.app_is_project_member(t.project_id))))));


--
-- Name: attachment attachment_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attachment_update ON public.attachment FOR UPDATE USING ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM (public.deliverable d
     JOIN public.task t ON ((t.id = d.task_id)))
  WHERE ((d.id = attachment.deliverable_id) AND public.app_has_min_role(t.project_id, 'MANAGER'::public.project_role))))));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT USING ((public.app_is_admin() OR ((project_id IS NOT NULL) AND public.app_is_project_member(project_id))));


--
-- Name: category; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;

--
-- Name: category category_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY category_insert ON public.category FOR INSERT WITH CHECK (public.app_is_admin());


--
-- Name: category category_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY category_select ON public.category FOR SELECT USING ((public.app_actor_id() IS NOT NULL));


--
-- Name: category category_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY category_update ON public.category FOR UPDATE USING (public.app_is_admin());


--
-- Name: deliverable; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deliverable ENABLE ROW LEVEL SECURITY;

--
-- Name: deliverable deliverable_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deliverable_insert ON public.deliverable FOR INSERT WITH CHECK ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM public.task t
  WHERE ((t.id = deliverable.task_id) AND public.app_has_min_role(t.project_id, 'MANAGER'::public.project_role))))));


--
-- Name: deliverable deliverable_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deliverable_select ON public.deliverable FOR SELECT USING ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM public.task t
  WHERE ((t.id = deliverable.task_id) AND public.app_is_project_member(t.project_id))))));


--
-- Name: deliverable deliverable_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deliverable_update ON public.deliverable FOR UPDATE USING ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM public.task t
  WHERE ((t.id = deliverable.task_id) AND public.app_has_min_role(t.project_id, 'MANAGER'::public.project_role))))));


--
-- Name: program; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.program ENABLE ROW LEVEL SECURITY;

--
-- Name: program program_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY program_insert ON public.program FOR INSERT WITH CHECK (public.app_is_admin());


--
-- Name: program program_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY program_select ON public.program FOR SELECT USING ((public.app_is_admin() OR (EXISTS ( SELECT 1
   FROM (public.project p
     JOIN public.project_member pm ON ((pm.project_id = p.id)))
  WHERE ((p.program_id = program.id) AND (pm.actor_id = public.app_actor_id()) AND (pm.deleted_at IS NULL))))));


--
-- Name: program program_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY program_update ON public.program FOR UPDATE USING (public.app_is_admin());


--
-- Name: project; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;

--
-- Name: project project_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_insert ON public.project FOR INSERT WITH CHECK (public.app_is_admin());


--
-- Name: project_member; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_member ENABLE ROW LEVEL SECURITY;

--
-- Name: project_member project_member_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_member_delete ON public.project_member FOR DELETE USING ((public.app_is_admin() OR public.app_has_min_role(project_id, 'DIRECTOR'::public.project_role)));


--
-- Name: project_member project_member_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_member_insert ON public.project_member FOR INSERT WITH CHECK ((public.app_is_admin() OR public.app_has_min_role(project_id, 'MANAGER'::public.project_role)));


--
-- Name: project_member project_member_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_member_select ON public.project_member FOR SELECT USING ((public.app_is_admin() OR public.app_is_project_member(project_id)));


--
-- Name: project_member project_member_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_member_update ON public.project_member FOR UPDATE USING ((public.app_is_admin() OR public.app_has_min_role(project_id, 'MANAGER'::public.project_role)));


--
-- Name: project project_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_select ON public.project FOR SELECT USING ((public.app_is_admin() OR public.app_is_project_member(id)));


--
-- Name: project project_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY project_update ON public.project FOR UPDATE USING ((public.app_is_admin() OR public.app_has_min_role(id, 'DIRECTOR'::public.project_role)));


--
-- Name: review; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.review ENABLE ROW LEVEL SECURITY;

--
-- Name: review review_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY review_insert ON public.review FOR INSERT TO ppm_app WITH CHECK (((current_setting('app.system_role'::text, true) = 'ADMIN'::text) OR (EXISTS ( SELECT 1
   FROM public.project_member pm
  WHERE ((pm.project_id = review.project_id) AND (pm.actor_id = public.app_actor_id()) AND (pm.deleted_at IS NULL) AND (pm.role = ANY (ARRAY['DIRECTOR'::public.project_role, 'MANAGER'::public.project_role])))))));


--
-- Name: review review_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY review_select ON public.review FOR SELECT TO ppm_app USING (((deleted_at IS NULL) AND ((current_setting('app.system_role'::text, true) = 'ADMIN'::text) OR (EXISTS ( SELECT 1
   FROM public.project_member pm
  WHERE ((pm.project_id = review.project_id) AND (pm.actor_id = public.app_actor_id()) AND (pm.deleted_at IS NULL)))))));


--
-- Name: review review_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY review_update ON public.review FOR UPDATE TO ppm_app USING (((deleted_at IS NULL) AND ((current_setting('app.system_role'::text, true) = 'ADMIN'::text) OR (EXISTS ( SELECT 1
   FROM public.project_member pm
  WHERE ((pm.project_id = review.project_id) AND (pm.actor_id = public.app_actor_id()) AND (pm.deleted_at IS NULL) AND (pm.role = ANY (ARRAY['DIRECTOR'::public.project_role, 'MANAGER'::public.project_role]))))))));


--
-- Name: task; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;

--
-- Name: task task_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY task_insert ON public.task FOR INSERT WITH CHECK ((public.app_is_admin() OR public.app_has_min_role(project_id, 'MANAGER'::public.project_role)));


--
-- Name: task task_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY task_select ON public.task FOR SELECT USING ((public.app_is_admin() OR public.app_is_project_member(project_id)));


--
-- Name: task task_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY task_update ON public.task FOR UPDATE USING ((public.app_is_admin() OR public.app_has_min_role(project_id, 'MANAGER'::public.project_role)));


--
-- Name: theme; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.theme ENABLE ROW LEVEL SECURITY;

--
-- Name: theme theme_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY theme_insert ON public.theme FOR INSERT WITH CHECK (public.app_is_admin());


--
-- Name: theme theme_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY theme_select ON public.theme FOR SELECT USING ((public.app_actor_id() IS NOT NULL));


--
-- Name: theme theme_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY theme_update ON public.theme FOR UPDATE USING (public.app_is_admin());


--
-- Name: time_entry; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.time_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entry time_entry_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entry_insert ON public.time_entry FOR INSERT WITH CHECK ((public.app_is_admin() OR (actor_id = public.app_actor_id())));


--
-- Name: time_entry time_entry_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entry_select ON public.time_entry FOR SELECT USING ((public.app_is_admin() OR (actor_id = public.app_actor_id()) OR (EXISTS ( SELECT 1
   FROM public.task t
  WHERE ((t.id = time_entry.task_id) AND public.app_has_min_role(t.project_id, 'MANAGER'::public.project_role))))));


--
-- Name: time_entry time_entry_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entry_update ON public.time_entry FOR UPDATE USING ((public.app_is_admin() OR (actor_id = public.app_actor_id())));


--
-- Name: todo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.todo ENABLE ROW LEVEL SECURITY;

--
-- Name: todo todo_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY todo_insert ON public.todo FOR INSERT WITH CHECK ((public.app_is_admin() OR public.app_has_min_role(project_id, 'MANAGER'::public.project_role)));


--
-- Name: todo todo_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY todo_select ON public.todo FOR SELECT USING ((public.app_is_admin() OR public.app_is_project_member(project_id)));


--
-- Name: todo todo_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY todo_update ON public.todo FOR UPDATE USING ((public.app_is_admin() OR public.app_has_min_role(project_id, 'MANAGER'::public.project_role)));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO ppm_app;


--
-- Name: TYPE todo_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE public.todo_status TO ppm_app;


--
-- Name: FUNCTION fn_cascade_soft_delete_deliverable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_cascade_soft_delete_deliverable() TO ppm_app;


--
-- Name: FUNCTION fn_cascade_soft_delete_program(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_cascade_soft_delete_program() TO ppm_app;


--
-- Name: FUNCTION fn_cascade_soft_delete_project(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_cascade_soft_delete_project() TO ppm_app;


--
-- Name: FUNCTION fn_cascade_soft_delete_task(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_cascade_soft_delete_task() TO ppm_app;


--
-- Name: TABLE activity; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.activity TO ppm_app;


--
-- Name: TABLE actor; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.actor TO ppm_app;


--
-- Name: TABLE attachment; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.attachment TO ppm_app;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.audit_log TO ppm_app;


--
-- Name: TABLE category; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.category TO ppm_app;


--
-- Name: TABLE deliverable; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deliverable TO ppm_app;


--
-- Name: TABLE program; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.program TO ppm_app;


--
-- Name: TABLE project; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project TO ppm_app;


--
-- Name: TABLE project_member; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.project_member TO ppm_app;


--
-- Name: TABLE review; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.review TO ppm_app;


--
-- Name: TABLE task; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task TO ppm_app;


--
-- Name: TABLE theme; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.theme TO ppm_app;


--
-- Name: TABLE time_entry; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.time_entry TO ppm_app;


--
-- Name: TABLE todo; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.todo TO ppm_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO ppm_app;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,UPDATE ON TABLES TO ppm_app;


--
-- PostgreSQL database dump complete
--

\unrestrict 9ndFf2o64wnsOOtM7NUYlf2Zy2b7wNTSnPxO3HxQeLyA7jSeq0iSyhTwoAGtwBw

