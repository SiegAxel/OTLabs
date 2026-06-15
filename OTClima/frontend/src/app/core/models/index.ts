export interface User {
  id: number;
  company_id?: number | null;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export type UserRole = 'superadmin' | 'admin' | 'technician';

export interface Technician extends User {
  phone?: string | null;
  active_ots: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Company {
  id: number;
  name: string;
  rut?: string;
  logo_path?: string;
  phone?: string;
  email?: string;
  address?: string;
  plan_type: string;
  quote_conditions?: string;
  quote_warranty?: string;
}

export interface Client {
  id: number;
  company_id?: number | null;
  nombre: string;
  rut?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export type OtStatus =
  | 'diagnosis'
  | 'quotation_sent'
  | 'approved'
  | 'in_execution'
  | 'finished'
  | 'paid'
  | 'rejected';

export type VisitType = 'free' | 'charged' | 'charged_deductible';

export interface WorkOrder {
  id: number;
  company_id: number;
  client_id: number;
  technician_id?: number;
  title: string;
  status: OtStatus;
  visit_type: VisitType;
  visit_cost: number;
  diagnosis_notes?: string;
  equipment_info?: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  technician?: User;
  quotation?: Quotation;
  payment?: Payment;
}

export interface QuotationItem {
  id?: number;
  description: string;
  qty: number;
  unit_price: number;
}

export interface Quotation {
  id: number;
  work_order_id: number;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  total: number;
  conditions?: string;
  warranty?: string;
  validity_days: number;
  sent_at?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  work_order_id: number;
  amount: number;
  method: string;
  notes?: string;
  paid_at: string;
}

export interface Evidence {
  id: number;
  description?: string;
  stage: string;
  uploaded_at: string;
  url: string;
}

export interface DashboardSummary {
  active_ots: number;
  pending_quotations: number;
  monthly_revenue: number;
  approval_rate: number;
  ot_by_status: { status: string; count: number }[];
  monthly_revenue_chart: { month: string; total: number }[];
  recent_ots: { id: number; title: string; status: string; created_at: string }[];
}

export const OT_STATUS_LABELS: Record<OtStatus, string> = {
  diagnosis: 'Diagnóstico',
  quotation_sent: 'Cotización enviada',
  approved: 'Aprobada',
  in_execution: 'En ejecución',
  finished: 'Finalizada',
  paid: 'Pagada',
  rejected: 'Rechazada',
};

export const OT_STATUS_STEPS: OtStatus[] = [
  'diagnosis', 'quotation_sent', 'approved', 'in_execution', 'finished', 'paid',
];

export const VALID_TRANSITIONS: Record<OtStatus, OtStatus[]> = {
  diagnosis: ['quotation_sent', 'rejected'],
  quotation_sent: ['approved', 'rejected'],
  approved: ['in_execution'],
  in_execution: ['finished'],
  finished: ['paid'],
  paid: [],
  rejected: [],
};
