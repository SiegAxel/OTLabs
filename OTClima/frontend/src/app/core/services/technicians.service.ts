import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Technician } from '../models';
import { environment } from '../../../environments/environment';

export interface TechnicianCreatePayload {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
}

export interface TechnicianUpdatePayload {
  name?: string;
  email?: string;
  password?: string;
  phone?: string | null;
  is_active?: boolean;
}

type TechnicianApiResponse = Technician | { data: Technician };
type TechniciansApiResponse =
  | Technician[]
  | {
      data?: Technician[];
      items?: Technician[];
      results?: Technician[];
    };

@Injectable({ providedIn: 'root' })
export class TechniciansService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/technicians`;
  private readonly collectionUrl = `${this.baseUrl}/`;

  getTechnicians(): Observable<Technician[]> {
    return this.http
      .get<TechniciansApiResponse>(this.collectionUrl)
      .pipe(map((response) => this.unwrapList(response)));
  }

  getTechnician(id: number): Observable<Technician> {
    return this.http
      .get<TechnicianApiResponse>(`${this.baseUrl}/${id}`)
      .pipe(map((response) => this.unwrapOne(response)));
  }

  createTechnician(data: TechnicianCreatePayload): Observable<Technician> {
    return this.http
      .post<TechnicianApiResponse>(this.collectionUrl, this.toCreatePayload(data))
      .pipe(map((response) => this.unwrapOne(response)));
  }

  updateTechnician(id: number, data: TechnicianUpdatePayload): Observable<Technician> {
    return this.http
      .put<TechnicianApiResponse>(`${this.baseUrl}/${id}`, this.toUpdatePayload(data))
      .pipe(map((response) => this.unwrapOne(response)));
  }

  toggleTechnicianActive(id: number): Observable<Technician> {
    return this.http
      .patch<TechnicianApiResponse>(`${this.baseUrl}/${id}/toggle-active`, {})
      .pipe(map((response) => this.unwrapOne(response)));
  }

  deactivateTechnician(id: number): Observable<Technician> {
    return this.http
      .delete<TechnicianApiResponse>(`${this.baseUrl}/${id}`)
      .pipe(map((response) => this.unwrapOne(response)));
  }

  private unwrapList(response: TechniciansApiResponse): Technician[] {
    if (Array.isArray(response)) return response.map((technician) => this.normalizeTechnician(technician));
    return (response.data ?? response.items ?? response.results ?? []).map((technician) =>
      this.normalizeTechnician(technician),
    );
  }

  private unwrapOne(response: TechnicianApiResponse): Technician {
    return this.normalizeTechnician('data' in response ? response.data : response);
  }

  private normalizeTechnician(technician: Technician): Technician {
    const source = technician as Technician & {
      full_name?: string;
      phone_number?: string;
      activeOts?: number;
      createdAt?: string;
      updatedAt?: string;
    };

    return {
      ...technician,
      company_id: source.company_id ?? null,
      name: source.name ?? source.full_name ?? '',
      email: source.email ?? '',
      role: 'technician',
      phone: source.phone ?? source.phone_number ?? '',
      is_active: source.is_active ?? true,
      active_ots: source.active_ots ?? source.activeOts ?? 0,
      created_at: source.created_at ?? source.createdAt ?? '',
      updated_at: source.updated_at ?? source.updatedAt ?? '',
    };
  }

  private toCreatePayload(data: TechnicianCreatePayload): TechnicianCreatePayload {
    return {
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      phone: data.phone?.trim() || null,
    };
  }

  private toUpdatePayload(data: TechnicianUpdatePayload): TechnicianUpdatePayload {
    const payload: TechnicianUpdatePayload = {
      name: data.name?.trim(),
      email: data.email?.trim(),
      phone: data.phone?.trim() || null,
      is_active: data.is_active,
    };

    if (data.password?.trim()) payload.password = data.password;
    return payload;
  }
}
