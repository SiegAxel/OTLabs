import { Client, Company, Evidence, Payment, Quotation, User, WorkOrder } from '../models';

export type MockAuthUser = User & { password: string };

const now = new Date();
const day = 24 * 60 * 60 * 1000;

export const MOCK_AUTH_USERS: MockAuthUser[] = [
  {
    id: 1,
    company_id: 1,
    name: 'Administrador OTClima',
    email: 'admin@otclima.cl',
    password: 'demo1234',
    role: 'admin',
    is_active: true,
  },
  {
    id: 2,
    company_id: 1,
    name: 'Carlos Herrera',
    email: 'carlos@otclima.cl',
    password: 'demo1234',
    role: 'technician',
    is_active: true,
  },
  {
    id: 3,
    company_id: 1,
    name: 'Daniela Rojas',
    email: 'daniela@otclima.cl',
    password: 'demo1234',
    role: 'technician',
    is_active: true,
  },
];

export const MOCK_COMPANY: Company = {
  id: 1,
  name: 'OTClima SpA',
  rut: '76.543.210-9',
  phone: '+56 9 1234 5678',
  email: 'contacto@otclima.cl',
  address: 'Av. Apoquindo 5000, Las Condes, Santiago',
  plan_type: 'pro',
  quote_conditions: '50% anticipo, saldo contra entrega.',
  quote_warranty: 'Garantia de 90 dias por servicio.',
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: 1,
    nombre: 'Clinica Los Andes',
    rut: '77.111.222-3',
    telefono: '+56 2 2456 8899',
    email: 'mantencion@clinicalosandes.cl',
    direccion: 'Providencia 2210, Santiago',
    notas: 'Contrato semestral de mantencion.',
    created_at: new Date(now.getTime() - 60 * day).toISOString(),
    updated_at: new Date(now.getTime() - 5 * day).toISOString(),
  },
  {
    id: 2,
    nombre: 'Comercial Norte Ltda.',
    rut: '96.222.333-4',
    telefono: '+56 9 9988 7766',
    email: 'operaciones@comercialnorte.cl',
    direccion: 'Av. La Marina 900, Vina del Mar',
    created_at: new Date(now.getTime() - 45 * day).toISOString(),
    updated_at: new Date(now.getTime() - 10 * day).toISOString(),
  },
  {
    id: 3,
    nombre: 'Edificio Costa Azul',
    rut: '65.444.555-6',
    telefono: '+56 9 3333 2222',
    email: 'administracion@costaazul.cl',
    direccion: 'Calle del Mar 345, Valparaiso',
    created_at: new Date(now.getTime() - 30 * day).toISOString(),
    updated_at: new Date(now.getTime() - 15 * day).toISOString(),
  },
];

export const MOCK_QUOTATIONS: Quotation[] = [
  {
    id: 1,
    work_order_id: 2,
    items: [
      { description: 'Limpieza profunda unidad interior', qty: 1, unit_price: 45000 },
      { description: 'Reposicion filtro HEPA', qty: 1, unit_price: 28000 },
    ],
    subtotal: 73000,
    discount: 3000,
    total: 70000,
    conditions: 'Validez 15 dias. Pago por transferencia.',
    warranty: 'Garantia de 30 dias.',
    validity_days: 15,
    sent_at: new Date(now.getTime() - 10 * day).toISOString(),
    created_at: new Date(now.getTime() - 11 * day).toISOString(),
  },
  {
    id: 2,
    work_order_id: 3,
    items: [
      { description: 'Cambio compresor 18.000 BTU', qty: 1, unit_price: 285000 },
      { description: 'Carga de gas refrigerante', qty: 1, unit_price: 45000 },
      { description: 'Mano de obra especializada', qty: 1, unit_price: 90000 },
    ],
    subtotal: 420000,
    discount: 20000,
    total: 400000,
    conditions: 'Incluye puesta en marcha.',
    warranty: 'Garantia de 90 dias.',
    validity_days: 20,
    sent_at: new Date(now.getTime() - 6 * day).toISOString(),
    created_at: new Date(now.getTime() - 7 * day).toISOString(),
  },
  {
    id: 3,
    work_order_id: 4,
    items: [
      { description: 'Mantencion preventiva 3 equipos', qty: 3, unit_price: 50000 },
    ],
    subtotal: 150000,
    discount: 0,
    total: 150000,
    conditions: 'Pago 30 dias.',
    warranty: 'Garantia de servicio 30 dias.',
    validity_days: 10,
    sent_at: new Date(now.getTime() - 3 * day).toISOString(),
    created_at: new Date(now.getTime() - 4 * day).toISOString(),
  },
];

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 1,
    work_order_id: 4,
    amount: 150000,
    method: 'transferencia',
    notes: 'Pagado en una cuota.',
    paid_at: new Date(now.getTime() - 2 * day).toISOString(),
  },
];

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: 1,
    company_id: 1,
    client_id: 1,
    technician_id: 2,
    title: 'Revision de fuga en sala de maquinas',
    status: 'diagnosis',
    visit_type: 'charged',
    visit_cost: 25000,
    diagnosis_notes: 'Posible perdida de refrigerante en tramo superior.',
    equipment_info: 'VRV Daikin 60.000 BTU',
    created_at: new Date(now.getTime() - 1 * day).toISOString(),
    updated_at: new Date(now.getTime() - 1 * day).toISOString(),
    status_history: [],
  },
  {
    id: 2,
    company_id: 1,
    client_id: 2,
    technician_id: 3,
    title: 'Mantencion correctiva oficina central',
    status: 'quotation_sent',
    visit_type: 'free',
    visit_cost: 0,
    diagnosis_notes: 'Filtros saturados y baja eficiencia de enfriamiento.',
    equipment_info: 'Split Midea 12.000 BTU',
    created_at: new Date(now.getTime() - 11 * day).toISOString(),
    updated_at: new Date(now.getTime() - 10 * day).toISOString(),
    status_history: [],
  },
  {
    id: 3,
    company_id: 1,
    client_id: 3,
    technician_id: 2,
    title: 'Cambio de compresor torre B',
    status: 'finished',
    visit_type: 'charged_deductible',
    visit_cost: 30000,
    diagnosis_notes: 'Compresor fuera de rango de presion.',
    equipment_info: 'Split muro 18.000 BTU',
    created_at: new Date(now.getTime() - 7 * day).toISOString(),
    updated_at: new Date(now.getTime() - 1 * day).toISOString(),
    status_history: [],
  },
  {
    id: 4,
    company_id: 1,
    client_id: 1,
    technician_id: 3,
    title: 'Mantencion preventiva trimestral',
    status: 'paid',
    visit_type: 'free',
    visit_cost: 0,
    diagnosis_notes: 'Trabajo completado sin observaciones.',
    equipment_info: '3 equipos split 9.000 BTU',
    created_at: new Date(now.getTime() - 4 * day).toISOString(),
    updated_at: new Date(now.getTime() - 2 * day).toISOString(),
    status_history: [],
  },
];

export const MOCK_EVIDENCES: Record<number, Evidence[]> = {
  1: [],
  2: [
    {
      id: 1,
      description: 'Filtro antes de limpieza',
      stage: 'diagnosis',
      uploaded_at: new Date(now.getTime() - 10 * day).toISOString(),
      url: 'assets/icons/icon-192x192.png',
    },
  ],
  3: [
    {
      id: 2,
      description: 'Compresor instalado',
      stage: 'execution',
      uploaded_at: new Date(now.getTime() - 1 * day).toISOString(),
      url: 'assets/icons/icon-192x192.png',
    },
  ],
  4: [
    {
      id: 3,
      description: 'Checklist de mantencion',
      stage: 'execution',
      uploaded_at: new Date(now.getTime() - 2 * day).toISOString(),
      url: 'assets/icons/icon-192x192.png',
    },
  ],
};
