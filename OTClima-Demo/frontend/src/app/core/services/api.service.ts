import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  Client, WorkOrder, Quotation, Payment, Evidence,
  DashboardSummary, User, Company
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Auth
  me() { return this.http.get<User>(`${this.base}/auth/me`); }

  // Company
  getCompany() { return this.http.get<Company>(`${this.base}/company`); }
  updateCompany(data: Partial<Company>) { return this.http.put<Company>(`${this.base}/company`, data); }
  uploadLogo(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<Company>(`${this.base}/company/logo`, fd);
  }

  // Clients
  getClients() { return this.http.get<Client[]>(`${this.base}/clients`); }
  getClient(id: number) { return this.http.get<Client>(`${this.base}/clients/${id}`); }
  createClient(data: Partial<Client>) { return this.http.post<Client>(`${this.base}/clients`, data); }
  updateClient(id: number, data: Partial<Client>) { return this.http.put<Client>(`${this.base}/clients/${id}`, data); }
  deleteClient(id: number) { return this.http.delete(`${this.base}/clients/${id}`); }

  // Work Orders
  getWorkOrders(status?: string) {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<WorkOrder[]>(`${this.base}/work-orders`, { params });
  }
  getWorkOrder(id: number) { return this.http.get<WorkOrder>(`${this.base}/work-orders/${id}`); }
  createWorkOrder(data: Partial<WorkOrder>) { return this.http.post<WorkOrder>(`${this.base}/work-orders`, data); }
  updateWorkOrder(id: number, data: Partial<WorkOrder>) {
    return this.http.put<WorkOrder>(`${this.base}/work-orders/${id}`, data);
  }
  transitionOt(id: number, newStatus: string) {
    return this.http.post<WorkOrder>(`${this.base}/work-orders/${id}/transition`, { new_status: newStatus });
  }
  deleteWorkOrder(id: number) { return this.http.delete(`${this.base}/work-orders/${id}`); }

  // Quotations
  getQuotation(otId: number) { return this.http.get<Quotation>(`${this.base}/work-orders/${otId}/quotation`); }
  createQuotation(otId: number, data: Partial<Quotation>) {
    return this.http.post<Quotation>(`${this.base}/work-orders/${otId}/quotation`, data);
  }
  updateQuotation(otId: number, data: Partial<Quotation>) {
    return this.http.put<Quotation>(`${this.base}/work-orders/${otId}/quotation`, data);
  }
  markQuotationSent(otId: number) {
    return this.http.post<Quotation>(`${this.base}/work-orders/${otId}/quotation/send`, {});
  }
  getPdfUrl(otId: number): string {
    return `${this.base}/work-orders/${otId}/quotation/pdf`;
  }

  // Payments
  registerPayment(otId: number, data: Partial<Payment>) {
    return this.http.post<Payment>(`${this.base}/work-orders/${otId}/payment`, data);
  }

  // Evidences
  getEvidences(otId: number) {
    return this.http.get<Evidence[]>(`${this.base}/work-orders/${otId}/evidences`);
  }
  uploadEvidence(otId: number, file: File, description: string, stage: string) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('description', description);
    fd.append('stage', stage);
    return this.http.post<Evidence>(`${this.base}/work-orders/${otId}/evidences`, fd);
  }
  deleteEvidence(evidenceId: number) {
    return this.http.delete(`${this.base}/work-orders/evidences/${evidenceId}`);
  }

  // Technicians
  getTechnicians() { return this.http.get<any[]>(`${this.base}/technicians`); }
  createTechnician(data: any) { return this.http.post<User>(`${this.base}/technicians`, data); }
  toggleTechnicianActive(id: number) {
    return this.http.put<User>(`${this.base}/technicians/${id}/toggle-active`, {});
  }

  // Reports
  getDashboardSummary() { return this.http.get<DashboardSummary>(`${this.base}/reports/summary`); }
  exportOts() { return this.http.get<any[]>(`${this.base}/reports/ots-export`); }
}
