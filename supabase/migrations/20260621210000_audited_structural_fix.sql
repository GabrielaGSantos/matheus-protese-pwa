-- =========================================================================
-- SCRIPT DE AUDITORIA E COMPATIBILIZAÇÃO (IDEMPOTENTE)
-- =========================================================================

-- Tabela `services`
-- Retira a restrição de NOT NULL de campos que o sistema não obriga mais.
ALTER TABLE public.services ALTER COLUMN default_value DROP NOT NULL;
ALTER TABLE public.services ALTER COLUMN default_estimated_time DROP NOT NULL;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS enters_paschoal_value boolean DEFAULT false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS enters_andrey_value boolean DEFAULT false;

-- Tabela `internal_notes`
-- Adiciona propriedades novas de UI e retira a obrigatoriedade do 'note' para a migração ao 'content'.
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS case_id text;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS important boolean DEFAULT false;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.internal_notes ALTER COLUMN note DROP NOT NULL;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS content text;
-- Compatibilidade retroativa para notas antigas
UPDATE public.internal_notes SET content = note WHERE content IS NULL AND note IS NOT NULL;

-- Tabela `calendar_events`
-- Retira obrigatoriedade de campos antigos para compatibilizar com 'start_date' e 'end_date' do React.
ALTER TABLE public.calendar_events ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE public.calendar_events ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.calendar_events ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS start_date timestamp with time zone;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS end_date timestamp with time zone;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS notes text;

-- Tabela `cases`
-- Adiciona colunas para controle do Drive e de valores internos sem remover nada.
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_number text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_status text DEFAULT 'not_created';
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_dentist_folder_id text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_case_folder_id text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_images_folder_id text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_scan_folder_id text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_result_folder_id text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_case_folder_url text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS drive_error_message text;

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS is_manual_price boolean DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS cost_andrey_discounted boolean DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS other_internal_costs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS selected_services jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS financial_released boolean DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS payment_receipt_url text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS pix_key text;

-- Tabela `profiles`
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linked_dentist_id text;

-- Adicionando FK para case_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_internal_notes_case') THEN
        ALTER TABLE public.internal_notes
        ADD CONSTRAINT fk_internal_notes_case
        FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Adicionando FK para created_by
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_internal_notes_created_by') THEN
        ALTER TABLE public.internal_notes
        ADD CONSTRAINT fk_internal_notes_created_by
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Recarregar cache de schema
NOTIFY pgrst, 'reload schema';

-- Adicionando updated_at em internal_notes, caso n�o exista (como apontado no erro de schema)
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Recarregar cache novamente
NOTIFY pgrst, 'reload schema';

