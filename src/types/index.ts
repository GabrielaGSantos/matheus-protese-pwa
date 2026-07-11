export type UserRole = 'admin' | 'dentist' | 'secretary' | 'auxiliar';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  whatsapp?: string;
  pix_key?: string;
  notes?: string;
  linked_dentist_id?: string;
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
  default_paschoal_value?: number;
  enters_andrey_value?: boolean;
  default_andrey_value?: number;
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

export type CaseStatus = string;

export type FinancialStatus = string;

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
  case_number?: string;
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
  // Real Drive integration fields
  drive_status?: 'not_created' | 'created' | 'error';
  drive_dentist_folder_id?: string;
  drive_case_folder_id?: string;
  drive_images_folder_id?: string;
  drive_scan_folder_id?: string;
  drive_result_folder_id?: string;
  drive_case_folder_url?: string;
  drive_error_message?: string;
  estimated_hours: number;
  value_matheus: number;
  value_planning: number;
  value_paschoal: number;
  cost_allan_matheus: number;
  cost_allan_solo: number;
  cost_andrey: number;
  cost_andrey_discounted?: boolean;
  other_internal_costs: { name: string; value: number; add_to_total?: boolean }[];
  total_value: number;
  paid_value: number;
  remaining_value: number;
  financial_released?: boolean;
  payment_receipt_url?: string;
  pix_key?: string;
  selected_services?: string[];
  is_manual_price?: boolean;
  updated_at: string;
}

export type CalendarEventType = 'feriado' | 'viagem' | 'bloqueio' | 'indisponibilidade' | 'neuroreab' | 'consulta';

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
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
  // Google Drive integration additions
  folder_id?: string;
  web_view_link?: string;
  file_category?: 'imagens' | 'escaneamento' | 'enceramento_digital' | 'resultado';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: 'new_case' | 'case_modified' | 'file_uploaded' | 'case_approved' | 'case_finished' | 'due_date';
  case_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface CustomStatus {
  id: string;
  label: string;
  colorClass: string;
  hexColor?: string;
}

export interface NotificationSettings {
  enable_push: boolean;
  enable_email: boolean;
  email_destinatario?: string;
  enable_telegram: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  pix_matheus?: string;
  pix_planning?: string;
  pix_paschoal?: string;
  custom_case_statuses?: CustomStatus[];
  custom_financial_statuses?: CustomStatus[];
}

export const DEFAULT_CASE_STATUSES: CustomStatus[] = [
  { id: 'recebido', label: 'Recebido', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'em_analise', label: 'Em Análise', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', colorClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { id: 'aguardando_arquivos', label: 'Pendente Envio de Arquivo', colorClass: 'bg-rose-600 text-white border-rose-700 animate-pulse font-black shadow-xs shadow-rose-200' },
  { id: 'em_execucao', label: 'Em Execução', colorClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  { id: 'finalizado', label: 'Finalizado', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { id: 'entregue', label: 'Entregue', colorClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  { id: 'cancelado', label: 'Cancelado', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
];

export const DEFAULT_FINANCIAL_STATUSES: CustomStatus[] = [
  { id: 'cobrar', label: 'Cobrar', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'aguardando_pagamento', label: 'Aguardando Pagamento', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'pago_parcial', label: 'Pago Parcial', colorClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  { id: 'pago', label: 'Pago', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { id: 'isento', label: 'Isento', colorClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  { id: 'cancelado', label: 'Cancelado', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
];

export interface NoteHistoryEntry {
  user_name: string;
  action: string;
  updated_at: string;
}

export interface InternalNote {
  id: string;
  case_id?: string;
  title: string;
  content: string;
  pinned: boolean;
  important: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  history: NoteHistoryEntry[];
}
