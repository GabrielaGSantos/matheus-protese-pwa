-- =========================================================================
-- DATABASE SETUP FOR DR. MATHEUS LABORATORY & FINANCIAL CONTROL
-- =========================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean existing structures if needed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS before_case_update ON public.cases;
DROP FUNCTION IF EXISTS public.handle_case_update();
DROP TRIGGER IF EXISTS after_case_change ON public.cases;
DROP FUNCTION IF EXISTS public.log_case_history();

DROP VIEW IF EXISTS public.dentist_cases;
DROP TABLE IF EXISTS public.file_attachments;
DROP TABLE IF EXISTS public.case_history;
DROP TABLE IF EXISTS public.case_services;
DROP TABLE IF EXISTS public.cases;
DROP TABLE IF EXISTS public.calendar_events;
DROP TABLE IF EXISTS public.dentist_custom_prices;
DROP TABLE IF EXISTS public.services;
DROP TABLE IF EXISTS public.profiles;

-- =========================================================================
-- 1. PROFILES TABLE (linked to Auth.users)
-- =========================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'dentist')),
  full_name text NOT NULL,
  whatsapp text,
  pix_key text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user is an admin without circular references
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Allow users to read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Allow admins to read all profiles"
  ON public.profiles FOR SELECT
  USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Allow admins to insert/update profiles"
  ON public.profiles FOR ALL
  USING (public.check_is_admin(auth.uid()));

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, whatsapp)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'dentist'),
    new.raw_user_meta_data->>'whatsapp'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- 2. SERVICES TABLE
-- =========================================================================
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  billing_type text NOT NULL CHECK (billing_type IN ('per_element', 'fixed')),
  default_value numeric(10, 2) NOT NULL DEFAULT 0.00,
  default_estimated_time numeric(6, 2) NOT NULL DEFAULT 0.00, -- em horas
  enters_matheus_value boolean NOT NULL DEFAULT true,
  enters_paschoal_value boolean NOT NULL DEFAULT false,
  is_internal_cost boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on Services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only of active services"
  ON public.services FOR SELECT
  USING (is_active = true OR public.check_is_admin(auth.uid()));

CREATE POLICY "Allow admin full control of services"
  ON public.services FOR ALL
  USING (public.check_is_admin(auth.uid()));


-- =========================================================================
-- 3. CUSTOM PRICES PER DENTIST
-- =========================================================================
CREATE TABLE public.dentist_custom_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  custom_value numeric(10, 2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT dentist_service_unique UNIQUE (dentist_id, service_id)
);

-- Enable RLS on Custom Prices
ALTER TABLE public.dentist_custom_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full control of custom prices"
  ON public.dentist_custom_prices FOR ALL
  USING (public.check_is_admin(auth.uid()));


-- =========================================================================
-- 4. CASES TABLE
-- =========================================================================
CREATE TABLE public.cases (
  id text PRIMARY KEY, -- formato: CASE-YYYYMM-XXXX
  dentist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  patient_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  requested_delivery_date date NOT NULL,
  final_delivery_date date,
  created_by uuid REFERENCES public.profiles(id),
  status text NOT NULL CHECK (status IN (
    'recebido', 'em_analise', 'aguardando_aprovacao', 'aguardando_arquivos', 'em_execucao', 'finalizado', 'entregue', 'cancelado'
  )) DEFAULT 'recebido',
  financial_status text NOT NULL CHECK (financial_status IN (
    'aguardando_pagamento', 'pago_parcial', 'pago', 'isento', 'cancelado'
  )) DEFAULT 'aguardando_pagamento',
  teeth_selection jsonb DEFAULT '[]'::jsonb, -- Odontograma FDI
  dentist_notes text,
  internal_notes text, -- Visível apenas para o Dr. Matheus
  has_photo boolean DEFAULT false,
  has_file boolean DEFAULT false,
  google_drive_folder_id text,
  google_drive_folder_url text,
  estimated_hours numeric(6, 2) DEFAULT 0.00,
  value_matheus numeric(10, 2) DEFAULT 0.00,
  value_planning numeric(10, 2) DEFAULT 0.00,
  value_paschoal numeric(10, 2) DEFAULT 0.00,
  cost_allan_matheus numeric(10, 2) DEFAULT 0.00,
  cost_allan_solo numeric(10, 2) DEFAULT 0.00,
  cost_andrey numeric(10, 2) DEFAULT 0.00,
  other_internal_costs jsonb DEFAULT '[]'::jsonb,
  total_value numeric(10, 2) DEFAULT 0.00,
  paid_value numeric(10, 2) DEFAULT 0.00,
  remaining_value numeric(10, 2) DEFAULT 0.00,
  payment_receipt_url text,
  pix_key text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on Cases
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access to cases"
  ON public.cases FOR ALL
  USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Allow dentists to read their own cases"
  ON public.cases FOR SELECT
  USING (dentist_id = auth.uid());

CREATE POLICY "Allow dentists to insert their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (dentist_id = auth.uid());

CREATE POLICY "Allow dentists to update their own cases under conditions"
  ON public.cases FOR UPDATE
  USING (dentist_id = auth.uid());

-- Trigger function for cases update (security + updated_at)
CREATE OR REPLACE FUNCTION public.handle_case_update()
RETURNS trigger AS $$
BEGIN
  -- Force updated_at time
  new.updated_at := now();

  -- If the user is NOT an admin, enforce strict rules:
  IF NOT public.check_is_admin(auth.uid()) THEN
    -- Status becomes "em_analise" if updated by dentist
    new.status := 'em_analise';
    
    -- Dentist cannot alter final dates, notes, or financial costs/details
    new.final_delivery_date := old.final_delivery_date;
    new.internal_notes := old.internal_notes;
    new.value_planning := old.value_planning;
    new.cost_allan_matheus := old.cost_allan_matheus;
    new.cost_allan_solo := old.cost_allan_solo;
    new.cost_andrey := old.cost_andrey;
    new.other_internal_costs := old.other_internal_costs;
    new.paid_value := old.paid_value;
    new.financial_status := old.financial_status;
    
    -- Values are computed by system, don't let client hack them
    new.value_matheus := old.value_matheus;
    new.value_paschoal := old.value_paschoal;
    new.total_value := old.total_value;
    new.remaining_value := new.total_value - new.paid_value;
  ELSE
    -- If admin is updating, compute remaining_value
    new.remaining_value := COALESCE(new.total_value, 0.00) - COALESCE(new.paid_value, 0.00);
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER before_case_update
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_case_update();


-- =========================================================================
-- 5. DENTIST SECURE VIEW (Filters fields for dentist clients)
-- =========================================================================
CREATE OR REPLACE VIEW public.dentist_cases AS
SELECT 
  id,
  dentist_id,
  patient_name,
  created_at,
  requested_delivery_date,
  final_delivery_date,
  status,
  financial_status,
  teeth_selection,
  dentist_notes,
  has_photo,
  has_file,
  google_drive_folder_url,
  value_matheus,
  value_paschoal,
  total_value,
  paid_value,
  remaining_value,
  payment_receipt_url,
  pix_key
FROM public.cases
WHERE dentist_id = auth.uid() OR public.check_is_admin(auth.uid());


-- =========================================================================
-- 6. CASE SERVICES
-- =========================================================================
CREATE TABLE public.case_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_value numeric(10, 2) NOT NULL DEFAULT 0.00,
  total_value numeric(10, 2) NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on Case Services
ALTER TABLE public.case_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access to case services"
  ON public.case_services FOR ALL
  USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Allow dentists to read their own case services"
  ON public.case_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c 
      WHERE c.id = case_services.case_id AND c.dentist_id = auth.uid()
    )
  );

CREATE POLICY "Allow dentists to insert services to their own cases"
  ON public.case_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c 
      WHERE c.id = case_services.case_id AND c.dentist_id = auth.uid()
    )
  );


-- =========================================================================
-- 7. CALENDAR & HOLIDAYS TABLE
-- =========================================================================
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  type text NOT NULL CHECK (type IN ('feriado', 'viagem', 'bloqueio', 'indisponibilidade')),
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on Calendar Events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of calendar events"
  ON public.calendar_events FOR SELECT
  USING (true);

CREATE POLICY "Allow admin full access to calendar events"
  ON public.calendar_events FOR ALL
  USING (public.check_is_admin(auth.uid()));


-- =========================================================================
-- 8. AUDIT LOG / HISTORICO TABLE
-- =========================================================================
CREATE TABLE public.case_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on Case History
ALTER TABLE public.case_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin to read all history"
  ON public.case_history FOR SELECT
  USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Allow dentists to read their own case history"
  ON public.case_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c 
      WHERE c.id = case_history.case_id AND c.dentist_id = auth.uid()
    )
  );

-- Trigger function for automatic logging
CREATE OR REPLACE FUNCTION public.log_case_history()
RETURNS trigger AS $$
DECLARE
  v_action text;
  v_prev jsonb := NULL;
  v_new jsonb := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(new);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'edit';
    v_prev := to_jsonb(old);
    v_new := to_jsonb(new);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_prev := to_jsonb(old);
  END IF;

  INSERT INTO public.case_history (case_id, user_id, action, previous_data, new_data)
  VALUES (
    COALESCE(new.id, old.id),
    auth.uid(),
    v_action,
    v_prev,
    v_new
  );
  RETURN COALESCE(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_case_change
  AFTER INSERT OR UPDATE OR DELETE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_history();


-- =========================================================================
-- 9. FILE ATTACHMENTS TABLE
-- =========================================================================
CREATE TABLE public.file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  google_drive_file_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on File Attachments
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access to attachments"
  ON public.file_attachments FOR ALL
  USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Allow dentists to read attachments of their own cases"
  ON public.file_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c 
      WHERE c.id = file_attachments.case_id AND c.dentist_id = auth.uid()
    )
  );

CREATE POLICY "Allow dentists to insert attachments of their own cases"
  ON public.file_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c 
      WHERE c.id = file_attachments.case_id AND c.dentist_id = auth.uid()
    )
  );


-- =========================================================================
-- 10. SEED SERVICES DATA
-- =========================================================================
INSERT INTO public.services (name, billing_type, default_value, default_estimated_time, enters_matheus_value, enters_paschoal_value, is_internal_cost) VALUES
('Enceramento Digital', 'per_element', 35.00, 1.0, true, false, false),
('Impressão', 'fixed', 50.00, 0.5, true, false, false),
('Fresagem', 'per_element', 120.00, 2.0, true, false, false),
('Coroa em Zirconia', 'per_element', 450.00, 4.0, true, false, false),
('Coroa de Dissilicato', 'per_element', 400.00, 4.0, true, false, false),
('Protocolo zirconia', 'fixed', 3500.00, 16.0, true, true, false),
('Modelo Total', 'fixed', 80.00, 1.0, true, false, false),
('Placa', 'fixed', 150.00, 2.0, true, false, false),
('Pigmentação', 'per_element', 60.00, 1.5, true, false, false),
('Gengiva', 'fixed', 300.00, 3.0, true, false, false),
('Finalização', 'fixed', 250.00, 2.5, true, false, false),
('Finalização P', 'fixed', 150.00, 1.5, true, false, false);
