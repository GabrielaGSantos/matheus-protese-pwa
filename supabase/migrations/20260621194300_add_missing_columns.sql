-- Tabela `services`
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text;

-- Tabela `internal_notes`
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;

-- Tabela `calendar_events`
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS notes text;

-- Tabela `cases`
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
