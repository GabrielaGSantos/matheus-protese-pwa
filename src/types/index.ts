export type UserRole = 'admin' | 'dentist' | 'secretary';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  whatsapp?: string;
  pix_key?: string;
  notes?: string;
  created_at: string;
}

export type BillingType = 'per_element' | 'fixed';

export interface Service {
  id: string;
  name: string;
  description?: string;
  billing_type: BillingType;
  default_value: number;
  default_estimated_time: number; // in hours
  enters_matheus_value: boolean;
  enters_paschoal_value: boolean;
  is_internal_cost: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DentistCustomPrice {
  id: string;
  dentist_id: string;
  service_id: string;
  custom_value: number;
  created_at: string;
}

export type CaseStatus = 
  | 'recebido' 
  | 'em_analise' 
  | 'aguardando_aprovacao' 
  | 'aguardando_arquivos' 
  | 'em_execucao' 
  | 'finalizado' 
  | 'entregue' 
  | 'cancelado';

export type FinancialStatus = 
  | 'aguardando_pagamento' 
  | 'pago_parcial' 
  | 'pago' 
  | 'isento' 
  | 'cancelado';

export interface OdontogramSelection {
  teeth: number[]; // FDI teeth numbers (e.g., 11, 21, etc.)
  type: 'individual' | 'superior' | 'inferior' | 'protocolo_superior' | 'protocolo_inferior' | 'ponte' | 'implante' | 'todos';
  bridgeRange?: [number, number]; // for bridges
}

export interface CaseService {
  id: string;
  case_id: string;
  service_id: string;
  quantity: number;
  unit_value: number;
  total_value: number;
}

export interface Case {
  id: string;
  dentist_id: string;
  patient_name: string;
  created_at: string;
  requested_delivery_date: string; // YYYY-MM-DD
  final_delivery_date?: string; // YYYY-MM-DD
  created_by?: string;
  status: CaseStatus;
  financial_status: FinancialStatus;
  teeth_selection: OdontogramSelection;
  dentist_notes?: string;
  internal_notes?: string;
  has_photo: boolean;
  has_file: boolean;
  google_drive_folder_id?: string;
  google_drive_folder_url?: string;
  estimated_hours: number;
  value_matheus: number;
  value_planning: number;
  value_paschoal: number;
  cost_allan_matheus: number;
  cost_allan_solo: number;
  cost_andrey: number;
  cost_andrey_discounted?: boolean;
  other_internal_costs: { name: string; value: number }[];
  total_value: number;
  paid_value: number;
  remaining_value: number;
  payment_receipt_url?: string;
  pix_key?: string;
  selected_services?: string[];
  updated_at: string;
}

export type CalendarEventType = 'feriado' | 'viagem' | 'bloqueio' | 'indisponibilidade';

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  type: CalendarEventType;
  notes?: string;
  created_at: string;
}

export interface CaseHistory {
  id: string;
  case_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  previous_data?: any;
  new_data?: any;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  case_id: string;
  google_drive_file_id: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
}
