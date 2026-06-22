-- Fix internal_notes schema
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS content text;

-- Fix services schema to support default values for Paschoal and Andrey
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS default_paschoal_value numeric(10,2) DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS default_andrey_value numeric(10,2) DEFAULT 0;

-- Fix RLS for logs and calendar to ensure inserts/selects are allowed for authenticated users
ALTER TABLE public.case_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.case_history;
CREATE POLICY "Enable all for authenticated users" ON public.case_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.calendar_events;
CREATE POLICY "Enable all for authenticated users" ON public.calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

