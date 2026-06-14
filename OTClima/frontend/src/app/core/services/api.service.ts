import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  Client,
  Company,
  DashboardSummary,
  Evidence,
  OtStatus,
  Payment,
  Quotation,
  User,
  WorkOrder,
} from '../models';
import {
  MOCK_AUTH_USERS,
  MOCK_CLIENTS,
  MOCK_COMPANY,
  MOCK_EVIDENCES,
  MOCK_PAYMENTS,
  MOCK_QUOTATIONS,
  MOCK_WORK_ORDERS,
} from './mock-data';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private company: Company = this.clone(MOCK_COMPANY);
  private clients: Client[] = this.clone(MOCK_CLIENTS);
  private workOrders: WorkOrder[] = this.clone(MOCK_WORK_ORDERS);
  private quotations: Quotation[] = this.clone(MOCK_QUOTATIONS);
  private payments: Payment[] = this.clone(MOCK_PAYMENTS);
  private evidences: Record<number, Evidence[]> = this.clone(MOCK_EVIDENCES);

  me() {
    return of<User | null>(null);
  }

  getCompany() {
    return of(this.clone(this.company));
  }

  updateCompany(data: Partial<Company>) {
    this.company = { ...this.company, ...data };
    return of(this.clone(this.company));
  }

  uploadLogo(file: File) {
    return new Observable<Company>((subscriber) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.company = { ...this.company, logo_path: String(reader.result ?? '') };
        subscriber.next(this.clone(this.company));
        subscriber.complete();
      };
      reader.onerror = () => {
        subscriber.error(new Error('No se pudo cargar el logo'));
      };
      reader.readAsDataURL(file);
    });
  }

  getClients() {
    return of(this.clone(this.clients));
  }

  getClient(id: number) {
    const client = this.clients.find((c) => c.id === id);
    return of(this.clone(client as Client));
  }

  createClient(data: Partial<Client>) {
    const now = new Date().toISOString();
    const client: Client = {
      id: this.nextId(this.clients),
      nombre: data.nombre ?? 'Cliente sin nombre',
      rut: data.rut ?? '',
      telefono: data.telefono ?? '',
      email: data.email ?? '',
      direccion: data.direccion ?? '',
      notas: data.notas ?? '',
      created_at: now,
      updated_at: now,
    };
    this.clients.unshift(client);
    return of(this.clone(client));
  }

  updateClient(id: number, data: Partial<Client>) {
    this.clients = this.clients.map((c) => (c.id === id ? { ...c, ...data } : c));
    const updated = this.clients.find((c) => c.id === id) as Client;
    this.hydrateWorkOrders();
    return of(this.clone(updated));
  }

  deleteClient(id: number) {
    this.clients = this.clients.filter((c) => c.id !== id);
    this.workOrders = this.workOrders.filter((w) => w.client_id !== id);
    return of({ ok: true });
  }

  getWorkOrders(status?: string) {
    this.hydrateWorkOrders();
    const all = this.clone(this.workOrders);
    return of(status ? all.filter((w) => w.status === status) : all);
  }

  getWorkOrder(id: number) {
    this.hydrateWorkOrders();
    const workOrder = this.workOrders.find((w) => w.id === id) as WorkOrder;
    return of(this.clone(workOrder));
  }

  createWorkOrder(data: Partial<WorkOrder>) {
    const workOrder: WorkOrder = {
      id: this.nextId(this.workOrders),
      company_id: 1,
      client_id: Number(data.client_id),
      technician_id: data.technician_id ? Number(data.technician_id) : undefined,
      title: data.title ?? 'OT sin titulo',
      status: 'diagnosis',
      visit_type: (data.visit_type as WorkOrder['visit_type']) ?? 'free',
      visit_cost: Number(data.visit_cost ?? 0),
      diagnosis_notes: data.diagnosis_notes ?? '',
      equipment_info: data.equipment_info ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.workOrders.unshift(workOrder);
    this.evidences[workOrder.id] = [];
    this.hydrateWorkOrders();
    return of(this.clone(this.workOrders[0]));
  }

  updateWorkOrder(id: number, data: Partial<WorkOrder>) {
    this.workOrders = this.workOrders.map((w) =>
      w.id === id ? { ...w, ...data, updated_at: new Date().toISOString() } : w,
    );
    this.hydrateWorkOrders();
    return of(this.clone(this.workOrders.find((w) => w.id === id) as WorkOrder));
  }

  transitionOt(id: number, newStatus: string) {
    const status = newStatus as OtStatus;
    return this.updateWorkOrder(id, { status });
  }

  deleteWorkOrder(id: number) {
    this.workOrders = this.workOrders.filter((w) => w.id !== id);
    this.quotations = this.quotations.filter((q) => q.work_order_id !== id);
    this.payments = this.payments.filter((p) => p.work_order_id !== id);
    delete this.evidences[id];
    return of({ ok: true });
  }

  getQuotation(otId: number) {
    const quotation = this.quotations.find((q) => q.work_order_id === otId) as Quotation;
    return of(this.clone(quotation));
  }

  createQuotation(otId: number, data: Partial<Quotation>) {
    const items = data.items ?? [];
    const subtotal = items.reduce((sum, item) => sum + (item.qty ?? 0) * (item.unit_price ?? 0), 0);
    const discount = Number(data.discount ?? 0);
    const quotation: Quotation = {
      id: this.nextId(this.quotations),
      work_order_id: otId,
      items: this.clone(items),
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
      conditions: data.conditions ?? this.company.quote_conditions ?? '',
      warranty: data.warranty ?? this.company.quote_warranty ?? '',
      validity_days: Number(data.validity_days ?? 15),
      created_at: new Date().toISOString(),
    };
    this.quotations = this.quotations.filter((q) => q.work_order_id !== otId);
    this.quotations.push(quotation);
    this.hydrateWorkOrders();
    return of(this.clone(quotation));
  }

  updateQuotation(otId: number, data: Partial<Quotation>) {
    const existing = this.quotations.find((q) => q.work_order_id === otId);
    if (!existing) return this.createQuotation(otId, data);
    const items = (data.items ?? existing.items).map((i) => ({ ...i }));
    const subtotal = items.reduce((sum, item) => sum + (item.qty ?? 0) * (item.unit_price ?? 0), 0);
    const discount = Number(data.discount ?? existing.discount ?? 0);
    const updated: Quotation = {
      ...existing,
      ...data,
      items,
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
      validity_days: Number(data.validity_days ?? existing.validity_days ?? 15),
    };
    this.quotations = this.quotations.map((q) => (q.work_order_id === otId ? updated : q));
    this.hydrateWorkOrders();
    return of(this.clone(updated));
  }

  markQuotationSent(otId: number) {
    const quotation = this.quotations.find((q) => q.work_order_id === otId);
    if (!quotation) return of(undefined as unknown as Quotation);
    quotation.sent_at = new Date().toISOString();
    return of(this.clone(quotation));
  }

  getPdfUrl(otId: number): string {
    const ot = this.workOrders.find((w) => w.id === otId);
    const content = `OT ${otId} - ${ot?.title ?? 'Cotizacion'}\nDocumento demo sin backend.`;
    return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
  }

  registerPayment(otId: number, data: Partial<Payment>) {
    const payment: Payment = {
      id: this.nextId(this.payments),
      work_order_id: otId,
      amount: Number(data.amount ?? 0),
      method: data.method ?? 'transferencia',
      notes: data.notes ?? '',
      paid_at: new Date().toISOString(),
    };
    this.payments = this.payments.filter((p) => p.work_order_id !== otId);
    this.payments.push(payment);
    this.workOrders = this.workOrders.map((w) =>
      w.id === otId ? { ...w, status: 'paid', updated_at: new Date().toISOString() } : w,
    );
    this.hydrateWorkOrders();
    return of(this.clone(payment));
  }

  getEvidences(otId: number) {
    return of(this.clone(this.evidences[otId] ?? []));
  }

  uploadEvidence(otId: number, file: File, description: string, stage: string) {
    const evidence: Evidence = {
      id: this.nextEvidenceId(),
      description,
      stage,
      uploaded_at: new Date().toISOString(),
      url: URL.createObjectURL(file),
    };
    if (!this.evidences[otId]) this.evidences[otId] = [];
    this.evidences[otId].unshift(evidence);
    return of(this.clone(evidence));
  }

  deleteEvidence(evidenceId: number) {
    Object.keys(this.evidences).forEach((otId) => {
      this.evidences[Number(otId)] = this.evidences[Number(otId)].filter((e) => e.id !== evidenceId);
    });
    return of({ ok: true });
  }

  getTechnicians() {
    this.hydrateWorkOrders();
    const technicians = this.workOrders.reduce<Record<number, number>>((acc, ot) => {
      if (!ot.technician_id) return acc;
      if (ot.status === 'paid' || ot.status === 'rejected') return acc;
      acc[ot.technician_id] = (acc[ot.technician_id] ?? 0) + 1;
      return acc;
    }, {});

    const usersById: Record<number, User> = this.usersById();
    const rows = Object.values(usersById)
      .filter((u) => u.role === 'technician')
      .map((u) => ({ ...u, active_ots: technicians[u.id] ?? 0 }));

    return of(this.clone(rows));
  }

  createTechnician(data: any) {
    const users = this.usersById();
    const newId = Math.max(0, ...Object.keys(users).map((id) => Number(id))) + 1;
    const user: User = {
      id: newId,
      company_id: 1,
      name: data.name,
      email: data.email,
      role: 'technician',
      is_active: true,
    };
    this.workOrders = this.workOrders.map((w) => ({ ...w }));
    users[newId] = user;
    this.injectUsers(users);
    return of(this.clone(user));
  }

  toggleTechnicianActive(id: number) {
    const users = this.usersById();
    if (users[id]) users[id] = { ...users[id], is_active: !users[id].is_active };
    this.injectUsers(users);
    return of(this.clone(users[id]));
  }

  getDashboardSummary() {
    this.hydrateWorkOrders();
    const active = this.workOrders.filter((w) => w.status !== 'paid' && w.status !== 'rejected').length;
    const pendingQuotations = this.workOrders.filter((w) => !w.quotation).length;

    const monthlyRevenue = this.payments
      .filter((p) => {
        const d = new Date(p.paid_at);
        return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const closed = this.workOrders.filter((w) => w.status === 'paid' || w.status === 'rejected').length;
    const approved = this.workOrders.filter((w) => w.status === 'paid').length;
    const approvalRate = closed === 0 ? 0 : Math.round((approved / closed) * 100);

    const byStatus: DashboardSummary['ot_by_status'] = [];
    const statusCount = this.workOrders.reduce<Record<string, number>>((acc, w) => {
      acc[w.status] = (acc[w.status] ?? 0) + 1;
      return acc;
    }, {});
    Object.keys(statusCount).forEach((status) => byStatus.push({ status, count: statusCount[status] }));

    const monthlyRevenueChart = this.lastSixMonths().map((month) => ({
      month: month.label,
      total: this.payments
        .filter((p) => {
          const d = new Date(p.paid_at);
          return d.getMonth() === month.month && d.getFullYear() === month.year;
        })
        .reduce((sum, p) => sum + p.amount, 0),
    }));

    const recent = this.clone(this.workOrders)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
      .map((w) => ({ id: w.id, title: w.title, status: w.status, created_at: w.created_at }));

    return of({
      active_ots: active,
      pending_quotations: pendingQuotations,
      monthly_revenue: monthlyRevenue,
      approval_rate: approvalRate,
      ot_by_status: byStatus,
      monthly_revenue_chart: monthlyRevenueChart,
      recent_ots: recent,
    });
  }

  exportOts() {
    this.hydrateWorkOrders();
    const rows = this.workOrders.map((w) => ({
      id: w.id,
      title: w.title,
      client: w.client?.nombre ?? 'Sin cliente',
      technician: w.technician?.name ?? '',
      status: w.status,
      total: w.quotation?.total ?? 0,
      paid_amount: w.payment?.amount ?? 0,
      created_at: w.created_at,
    }));
    return of(this.clone(rows));
  }

  private hydrateWorkOrders() {
    const users = this.usersById();
    this.workOrders = this.workOrders.map((w) => ({
      ...w,
      client: this.clients.find((c) => c.id === w.client_id),
      technician: w.technician_id ? users[w.technician_id] : undefined,
      quotation: this.quotations.find((q) => q.work_order_id === w.id),
      payment: this.payments.find((p) => p.work_order_id === w.id),
    }));
  }

  private usersById(): Record<number, User> {
    const records = localStorage.getItem('otclima_users');
    const parsed = records ? (JSON.parse(records) as User[]) : [];
    const seedUsers = MOCK_AUTH_USERS.map(({ password: _password, ...user }) => user);
    const all = parsed.length > 0 ? parsed : seedUsers;
    return all.reduce<Record<number, User>>((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});
  }

  private injectUsers(usersById: Record<number, User>) {
    localStorage.setItem('otclima_users', JSON.stringify(Object.values(usersById)));
    this.hydrateWorkOrders();
  }

  private nextId<T extends { id: number }>(rows: T[]): number {
    return Math.max(0, ...rows.map((r) => r.id)) + 1;
  }

  private nextEvidenceId(): number {
    const all = Object.values(this.evidences).flat();
    return Math.max(0, ...all.map((e) => e.id)) + 1;
  }

  private lastSixMonths() {
    const months: { month: number; year: number; label: string }[] = [];
    const formatter = new Intl.DateTimeFormat('es-CL', { month: 'short' });
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: formatter.format(date).replace('.', ''),
      });
    }
    return months;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
