import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company } from '../models';

type CompanyApiResponse = Company | { data: Company };

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private http = inject(HttpClient);
  private readonly primaryUrl = `${environment.apiUrl}/company`;
  private readonly fallbackUrl = `${environment.apiUrl}/companies/me`;

  getCompany(): Observable<Company> {
    return this.http.get<CompanyApiResponse>(this.primaryUrl).pipe(
      catchError((error) => {
        if (error.status === 404) return this.http.get<CompanyApiResponse>(this.fallbackUrl);
        return throwError(() => error);
      }),
      map((response) => this.unwrap(response)),
    );
  }

  updateCompany(data: Partial<Company>): Observable<Company> {
    const payload = this.toPayload(data);
    return this.http.put<CompanyApiResponse>(this.primaryUrl, payload).pipe(
      catchError((error) => {
        if (error.status === 404) return this.http.put<CompanyApiResponse>(this.fallbackUrl, payload);
        return throwError(() => error);
      }),
      map((response) => this.unwrap(response)),
    );
  }

  uploadLogo(file: File): Observable<Company> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<CompanyApiResponse>(`${this.primaryUrl}/logo`, formData).pipe(
      catchError((error) => {
        if (error.status === 404) return this.http.post<CompanyApiResponse>(`${this.fallbackUrl}/logo`, formData);
        return throwError(() => error);
      }),
      map((response) => this.unwrap(response)),
    );
  }

  private unwrap(response: CompanyApiResponse): Company {
    return 'data' in response ? response.data : response;
  }

  private toPayload(data: Partial<Company>): Partial<Company> {
    return {
      name: data.name?.trim(),
      rut: data.rut?.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      quote_conditions: data.quote_conditions?.trim(),
      quote_warranty: data.quote_warranty?.trim(),
    };
  }
}
