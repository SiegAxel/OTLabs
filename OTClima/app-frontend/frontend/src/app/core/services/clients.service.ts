import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Client } from '../models';
import { environment } from '../../../environments/environment';

export type ClientCreatePayload = Pick<Client, 'nombre' | 'rut'> &
  Partial<Pick<Client, 'telefono' | 'email' | 'direccion' | 'notas'>>;
export type ClientUpdatePayload = Partial<ClientCreatePayload>;

type ClientApiResponse = Client | { data: Client };
type ClientsApiResponse =
  | Client[]
  | {
      data?: Client[];
      items?: Client[];
      results?: Client[];
    };

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/clients`;
  private readonly collectionUrl = `${this.baseUrl}/`;

  getClients(): Observable<Client[]> {
    return this.http.get<ClientsApiResponse>(this.collectionUrl).pipe(map((response) => this.unwrapList(response)));
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<ClientApiResponse>(`${this.baseUrl}/${id}`).pipe(map((response) => this.unwrapOne(response)));
  }

  createClient(data: ClientCreatePayload): Observable<Client> {
    return this.http
      .post<ClientApiResponse>(this.collectionUrl, this.toPayload(data))
      .pipe(map((response) => this.unwrapOne(response)));
  }

  updateClient(id: number, data: ClientUpdatePayload): Observable<Client> {
    return this.http
      .put<ClientApiResponse>(`${this.baseUrl}/${id}`, this.toPayload(data))
      .pipe(map((response) => this.unwrapOne(response)));
  }

  deleteClient(id: number): Observable<void> {
    return this.http.delete<unknown>(`${this.baseUrl}/${id}`).pipe(map(() => undefined));
  }

  private unwrapList(response: ClientsApiResponse): Client[] {
    if (Array.isArray(response)) return response.map((client) => this.normalizeClient(client));
    return (response.data ?? response.items ?? response.results ?? []).map((client) => this.normalizeClient(client));
  }

  private unwrapOne(response: ClientApiResponse): Client {
    return this.normalizeClient('data' in response ? response.data : response);
  }

  private normalizeClient(client: Client): Client {
    const source = client as Client & {
      name?: string;
      phone?: string;
      address?: string;
      notes?: string;
      createdAt?: string;
      updatedAt?: string;
    };

    return {
      ...client,
      nombre: source.nombre ?? source.name ?? '',
      telefono: source.telefono ?? source.phone ?? '',
      direccion: source.direccion ?? source.address ?? '',
      notas: source.notas ?? source.notes ?? '',
      created_at: source.created_at ?? source.createdAt ?? '',
      updated_at: source.updated_at ?? source.updatedAt ?? '',
    };
  }

  private toPayload(data: ClientUpdatePayload): ClientUpdatePayload {
    return {
      nombre: data.nombre?.trim(),
      rut: data.rut?.trim(),
      telefono: data.telefono?.trim(),
      email: data.email?.trim(),
      direccion: data.direccion?.trim(),
      notas: data.notas?.trim(),
    };
  }
}
