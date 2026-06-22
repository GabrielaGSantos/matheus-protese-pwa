-- Tabela `services`
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS enters_paschoal_value boolean DEFAULT false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS enters_andrey_value boolean DEFAULT false;
