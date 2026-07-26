import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardSummary,
  Evidence,
  OtStatus,
  Payment,
  Quotation,
  WorkOrder,
} from '../models';
import { normalizeStatusHistory } from '../utils/work-order-history';

export interface WorkOrderCreatePayload {
  client_id: number;
  technician_id?: number | null;
  title: string;
  visit_type: WorkOrder['visit_type'];
  visit_cost?: number;
  diagnosis_notes?: string | null;
  equipment_info?: string | null;
}

export type WorkOrderUpdatePayload = Partial<WorkOrderCreatePayload & { status: WorkOrder['status'] }>;

export interface QuotationPayload {
  items: Quotation['items'];
  discount?: number;
  conditions?: string | null;
  warranty?: string | null;
  validity_days?: number;
}

export interface PaymentPayload {
  amount: number;
  method: string;
  notes?: string | null;
}

type WorkOrderApiResponse = WorkOrder | { data: WorkOrder };
type WorkOrdersApiResponse = WorkOrder[] | { data?: WorkOrder[]; items?: WorkOrder[]; results?: WorkOrder[] };
type QuotationApiResponse = Quotation | { data: Quotation };
type EvidenceApiResponse = Evidence | { data: Evidence };
type EvidencesApiResponse = Evidence[] | { data?: Evidence[]; items?: Evidence[]; results?: Evidence[] };
type PaymentApiResponse = Payment | { data: Payment };

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work-orders`;
  private readonly collectionUrl = `${this.baseUrl}/`;

  getWorkOrders(status?: string): Observable<WorkOrder[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http
      .get<WorkOrdersApiResponse>(this.collectionUrl, { params })
      .pipe(map((response) => this.unwrapList(response)));
  }

  getWorkOrder(id: number): Observable<WorkOrder> {
    return this.http.get<WorkOrderApiResponse>(`${this.baseUrl}/${id}`).pipe(map((response) => this.unwrapOne(response)));
  }

  createWorkOrder(data: WorkOrderCreatePayload): Observable<WorkOrder> {
    return this.http
      .post<WorkOrderApiResponse>(this.collectionUrl, this.toWorkOrderPayload(data))
      .pipe(map((response) => this.unwrapOne(response)));
  }

  updateWorkOrder(id: number, data: WorkOrderUpdatePayload): Observable<WorkOrder> {
    return this.http
      .put<WorkOrderApiResponse>(`${this.baseUrl}/${id}`, this.toWorkOrderPayload(data))
      .pipe(map((response) => this.unwrapOne(response)));
  }

  transitionOt(id: number, status: OtStatus): Observable<WorkOrder> {
    return this.http
      .patch<WorkOrderApiResponse>(`${this.baseUrl}/${id}/transition`, { status })
      .pipe(map((response) => this.unwrapOne(response)));
  }

  deleteWorkOrder(id: number): Observable<void> {
    return this.http.delete<unknown>(`${this.baseUrl}/${id}`).pipe(map(() => undefined));
  }

  getQuotation(workOrderId: number): Observable<Quotation> {
    return this.http
      .get<QuotationApiResponse>(`${this.baseUrl}/${workOrderId}/quotation`)
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  createQuotation(workOrderId: number, data: QuotationPayload): Observable<Quotation> {
    return this.http
      .post<QuotationApiResponse>(`${this.baseUrl}/${workOrderId}/quotation`, this.toQuotationPayload(data))
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  updateQuotation(workOrderId: number, data: QuotationPayload): Observable<Quotation> {
    return this.http
      .put<QuotationApiResponse>(`${this.baseUrl}/${workOrderId}/quotation`, this.toQuotationPayload(data))
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  markQuotationSent(workOrderId: number): Observable<WorkOrder> {
    return this.http
      .post<WorkOrderApiResponse>(`${this.baseUrl}/${workOrderId}/quotation/send`, {})
      .pipe(map((response) => this.unwrapOne(response)));
  }

  getEvidences(workOrderId: number): Observable<Evidence[]> {
    return this.http
      .get<EvidencesApiResponse>(`${this.baseUrl}/${workOrderId}/evidences`)
      .pipe(map((response) => this.unwrapEvidenceList(response)));
  }

  uploadEvidence(workOrderId: number, file: File, description: string): Observable<Evidence> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);

    return this.http
      .post<EvidenceApiResponse>(`${this.baseUrl}/${workOrderId}/evidences`, formData)
      .pipe(map((response) => this.normalizeEvidence(this.unwrapResponse(response))));
  }

  deleteEvidence(evidenceId: number): Observable<void> {
    return this.http.delete<unknown>(`${this.baseUrl}/evidences/${evidenceId}`).pipe(map(() => undefined));
  }

  registerPayment(workOrderId: number, data: PaymentPayload): Observable<Payment> {
    return this.http
      .post<PaymentApiResponse>(`${this.baseUrl}/${workOrderId}/payment`, this.toPaymentPayload(data))
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  getPdfUrl(workOrderId: number): string {
    return `${this.baseUrl}/${workOrderId}/pdf`;
  }

  getPdf(workOrderId: number): Observable<Blob> {
    return this.http.get(this.getPdfUrl(workOrderId), { responseType: 'blob' });
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.getWorkOrders().pipe(map((workOrders) => this.buildSummary(workOrders)));
  }

  exportOts(): Observable<
    {
      id: number;
      title: string;
      client: string;
      technician: string;
      status: string;
      total: number;
      paid_amount: number;
      created_at: string;
    }[]
  > {
    return this.getWorkOrders().pipe(
      map((workOrders) =>
        workOrders.map((workOrder) => ({
          id: workOrder.id,
          title: workOrder.title,
          client: workOrder.client?.nombre ?? 'Sin cliente',
          technician: workOrder.technician?.name ?? '',
          status: workOrder.status,
          total: workOrder.quotation?.total ?? 0,
          paid_amount: workOrder.payment?.amount ?? 0,
          created_at: workOrder.created_at,
        })),
      ),
    );
  }

  private unwrapList(response: WorkOrdersApiResponse): WorkOrder[] {
    if (Array.isArray(response)) return response.map((workOrder) => this.normalizeWorkOrder(workOrder));
    return (response.data ?? response.items ?? response.results ?? []).map((workOrder) => this.normalizeWorkOrder(workOrder));
  }

  private unwrapOne(response: WorkOrderApiResponse): WorkOrder {
    return this.normalizeWorkOrder(this.unwrapResponse(response));
  }

  private unwrapEvidenceList(response: EvidencesApiResponse): Evidence[] {
    const evidences = Array.isArray(response)
      ? response
      : response.data ?? response.items ?? response.results ?? [];
    const unique = new Map<number, Evidence>();
    evidences.forEach((evidence) => {
      if (!unique.has(evidence.id)) unique.set(evidence.id, this.normalizeEvidence(evidence));
    });
    return [...unique.values()].sort(
      (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
    );
  }

  private normalizeEvidence(evidence: Evidence): Evidence {
    return {
      ...evidence,
      description: evidence.description ?? '',
      stage: evidence.stage === 'execution' ? 'in_execution' : evidence.stage,
      uploaded_at: evidence.uploaded_at ?? '',
      uploaded_by: evidence.uploaded_by ?? null,
    };
  }

  private unwrapResponse<T>(response: T | { data: T }): T {
    return 'data' in (response as { data?: T }) ? (response as { data: T }).data : (response as T);
  }

  private normalizeWorkOrder(workOrder: WorkOrder): WorkOrder {
    return {
      ...workOrder,
      diagnosis_notes: workOrder.diagnosis_notes ?? '',
      equipment_info: workOrder.equipment_info ?? '',
      created_at: workOrder.created_at ?? '',
      updated_at: workOrder.updated_at ?? '',
      status_history: normalizeStatusHistory(workOrder.status_history),
    };
  }

  private toWorkOrderPayload(data: WorkOrderUpdatePayload): WorkOrderUpdatePayload {
    return {
      client_id: data.client_id === null || data.client_id === undefined ? undefined : Number(data.client_id),
      technician_id: data.technician_id === null || data.technician_id === undefined ? null : Number(data.technician_id),
      title: data.title?.trim(),
      status: data.status,
      visit_type: data.visit_type,
      visit_cost: Number(data.visit_cost ?? 0),
      diagnosis_notes: data.diagnosis_notes?.trim() || null,
      equipment_info: data.equipment_info?.trim() || null,
    };
  }

  private toQuotationPayload(data: QuotationPayload): QuotationPayload {
    return {
      items: data.items.map((item) => ({
        description: item.description.trim(),
        qty: Number(item.qty ?? 1),
        unit_price: Number(item.unit_price ?? 0),
      })),
      discount: Number(data.discount ?? 0),
      conditions: data.conditions?.trim() || null,
      warranty: data.warranty?.trim() || null,
      validity_days: Number(data.validity_days ?? 15),
    };
  }

  private toPaymentPayload(data: PaymentPayload): PaymentPayload {
    return {
      amount: Number(data.amount ?? 0),
      method: data.method.trim(),
      notes: data.notes?.trim() || null,
    };
  }

  private buildSummary(workOrders: WorkOrder[]): DashboardSummary {
    const active_ots = workOrders.filter((workOrder) => workOrder.status !== 'paid' && workOrder.status !== 'rejected').length;
    const pending_quotations = workOrders.filter((workOrder) => !workOrder.quotation).length;
    const now = new Date();
    const monthly_revenue = workOrders
      .map((workOrder) => workOrder.payment)
      .filter((payment): payment is Payment => !!payment?.paid_at)
      .filter((payment) => {
        const date = new Date(payment.paid_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

    const closed = workOrders.filter((workOrder) => workOrder.status === 'paid' || workOrder.status === 'rejected').length;
    const approved = workOrders.filter((workOrder) => workOrder.status === 'paid').length;
    const statusCount = workOrders.reduce<Record<string, number>>((acc, workOrder) => {
      acc[workOrder.status] = (acc[workOrder.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      active_ots,
      pending_quotations,
      monthly_revenue,
      approval_rate: closed === 0 ? 0 : Math.round((approved / closed) * 100),
      ot_by_status: Object.entries(statusCount).map(([status, count]) => ({ status, count })),
      monthly_revenue_chart: this.lastSixMonths().map((month) => ({
        month: month.label,
        total: workOrders
          .map((workOrder) => workOrder.payment)
          .filter((payment): payment is Payment => !!payment?.paid_at)
          .filter((payment) => {
            const date = new Date(payment.paid_at);
            return date.getMonth() === month.month && date.getFullYear() === month.year;
          })
          .reduce((sum, payment) => sum + payment.amount, 0),
      })),
      recent_ots: [...workOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map((workOrder) => ({
          id: workOrder.id,
          title: workOrder.title,
          status: workOrder.status,
          created_at: workOrder.created_at,
        })),
    };
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
}
