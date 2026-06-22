-- Migration: UUID Primary Key para Cases e Ajuste Case History
-- Executar no Supabase SQL Editor

BEGIN;

-- 1. CORREÇÃO DE CASE_HISTORY
ALTER TABLE public.case_history ADD COLUMN IF NOT EXISTS previous_data JSONB;
ALTER TABLE public.case_history ADD COLUMN IF NOT EXISTS new_data JSONB;

-- 2. PREPARAÇÃO PARA UUID EM CASES
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_number TEXT;

-- 3. CÓPIA DE DADOS (PRESERVAÇÃO DO ID ANTIGO)
UPDATE public.cases
SET case_number = id
WHERE case_number IS NULL OR case_number = '';

-- 4. PREPARAÇÃO DAS TABELAS FILHAS E MAPEAMENTO
-- Adiciona colunas uuid
ALTER TABLE public.case_history ADD COLUMN IF NOT EXISTS case_uuid UUID;
ALTER TABLE public.case_attachments ADD COLUMN IF NOT EXISTS case_uuid UUID;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS case_uuid UUID;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS case_uuid UUID;

-- Cria tabelas temporárias (ou atualiza) se case_services existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_services') THEN
        EXECUTE 'ALTER TABLE public.case_services ADD COLUMN IF NOT EXISTS case_uuid UUID';
        EXECUTE 'UPDATE public.case_services cs SET case_uuid = c.uuid_id FROM public.cases c WHERE cs.case_id = c.id';
    END IF;
END $$;

-- Update child tables
UPDATE public.case_history ch SET case_uuid = c.uuid_id FROM public.cases c WHERE ch.case_id = c.id;
UPDATE public.case_attachments ca SET case_uuid = c.uuid_id FROM public.cases c WHERE ca.case_id = c.id;
UPDATE public.internal_notes n SET case_uuid = c.uuid_id FROM public.cases c WHERE n.case_id = c.id;
UPDATE public.calendar_events ce SET case_uuid = c.uuid_id FROM public.cases c WHERE ce.case_id = c.id;

-- LIMPEZA DE ÓRFÃOS (REGISTROS CUJO CASO PAI NÃO EXISTE MAIS)
-- Remove registros que não conseguiram mapear o UUID porque o case_id não existe mais na tabela cases.
DELETE FROM public.case_history WHERE case_id IS NOT NULL AND case_uuid IS NULL;
DELETE FROM public.case_attachments WHERE case_id IS NOT NULL AND case_uuid IS NULL;
DELETE FROM public.internal_notes WHERE case_id IS NOT NULL AND case_uuid IS NULL;
DELETE FROM public.calendar_events WHERE case_id IS NOT NULL AND case_uuid IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_services') THEN
        EXECUTE 'DELETE FROM public.case_services WHERE case_id IS NOT NULL AND case_uuid IS NULL';
    END IF;
END $$;

-- 5. VALIDAÇÃO DE INTEGRIDADE (FAIL-SAFE)
DO $$
DECLARE
    null_count INT;
BEGIN
    SELECT count(*) INTO null_count FROM public.case_history WHERE case_id IS NOT NULL AND case_uuid IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'Falha de integridade: % registros em case_history não mapeados para UUID.', null_count; END IF;

    SELECT count(*) INTO null_count FROM public.case_attachments WHERE case_id IS NOT NULL AND case_uuid IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'Falha de integridade: % registros em case_attachments não mapeados para UUID.', null_count; END IF;

    SELECT count(*) INTO null_count FROM public.internal_notes WHERE case_id IS NOT NULL AND case_uuid IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'Falha de integridade: % registros em internal_notes não mapeados para UUID.', null_count; END IF;

    SELECT count(*) INTO null_count FROM public.calendar_events WHERE case_id IS NOT NULL AND case_uuid IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'Falha de integridade: % registros em calendar_events não mapeados para UUID.', null_count; END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_services') THEN
        EXECUTE 'SELECT count(*) FROM public.case_services WHERE case_id IS NOT NULL AND case_uuid IS NULL' INTO null_count;
        IF null_count > 0 THEN RAISE EXCEPTION 'Falha de integridade: % registros em case_services não mapeados para UUID.', null_count; END IF;
    END IF;
END $$;

-- 6. ROTAÇÃO DE CHAVES E LIMPEZA DE CONSTRAINTS DEPENDENTES
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Encontra e remove todas as foreign keys que referenciam public.cases(id)
    FOR r IN (
        SELECT 
            tc.table_name, 
            tc.constraint_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'cases' AND ccu.column_name = 'id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Drop da Primary Key antiga
DO $$
DECLARE
    pk_name TEXT;
BEGIN
    SELECT constraint_name INTO pk_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND constraint_type = 'PRIMARY KEY';
      
    IF pk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.cases DROP CONSTRAINT ' || quote_ident(pk_name);
    END IF;
END $$;

-- Renomeia colunas
ALTER TABLE public.cases RENAME COLUMN id TO old_id_txt;
ALTER TABLE public.cases RENAME COLUMN uuid_id TO id;

-- Nova Primary Key
ALTER TABLE public.cases ADD PRIMARY KEY (id);

-- 7. AJUSTE FINAL NAS TABELAS FILHAS
-- Caso falhe o cast automático depois, nós vamos alterar os tipos removendo o antigo e renomeando o novo.
ALTER TABLE public.case_history DROP COLUMN case_id;
ALTER TABLE public.case_history RENAME COLUMN case_uuid TO case_id;
ALTER TABLE public.case_history ADD CONSTRAINT case_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.case_attachments DROP COLUMN case_id;
ALTER TABLE public.case_attachments RENAME COLUMN case_uuid TO case_id;
ALTER TABLE public.case_attachments ADD CONSTRAINT case_attachments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.internal_notes DROP COLUMN case_id;
ALTER TABLE public.internal_notes RENAME COLUMN case_uuid TO case_id;
ALTER TABLE public.internal_notes ADD CONSTRAINT internal_notes_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_events DROP COLUMN case_id;
ALTER TABLE public.calendar_events RENAME COLUMN case_uuid TO case_id;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_services') THEN
        EXECUTE 'ALTER TABLE public.case_services DROP COLUMN case_id';
        EXECUTE 'ALTER TABLE public.case_services RENAME COLUMN case_uuid TO case_id';
        EXECUTE 'ALTER TABLE public.case_services ADD CONSTRAINT case_services_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE';
    END IF;
END $$;

COMMIT;
