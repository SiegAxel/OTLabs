import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface MeResponse {
  id: number;
  username: string;
  email: string;
  company_id?: number | null;
  is_active: boolean;
  is_verified: boolean;
  primary_role: string;
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'otclima_token';
  private readonly REFRESH_TOKEN_KEY = 'otclima_refresh_token';
  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<{ access_token: string }> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        username: email,
        password,
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.ACCESS_TOKEN_KEY, res.access_token);
          localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refresh_token);
        }),
        switchMap((res) =>
          this.me().pipe(
            tap((user) => this.currentUser.set(user)),
            map(() => ({ access_token: res.access_token })),
          ),
        ),
      );
  }

  loadCurrentUser() {
    return this.getCurrentUser().subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.logout(),
    });
  }

  getCurrentUser(): Observable<User> {
    return this.me().pipe(tap((user) => this.currentUser.set(user)));
  }

  logout() {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    const payload = refreshToken ? { refresh_token: refreshToken } : {};

    this.http
      .post<string>(`${environment.apiUrl}/auth/logout`, payload)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.clearSession());
  }

  getToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    const role = this.currentUser()?.role;
    return role === 'admin' || role === 'superadmin';
  }

  isCompanyAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  isSuperAdmin(): boolean {
    return this.currentUser()?.role === 'superadmin';
  }

  private me() {
    return this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(map((me) => this.mapMeToUser(me)));
  }

  private mapMeToUser(me: MeResponse): User {
    return {
      id: me.id,
      company_id: me.company_id ?? null,
      name: me.username || me.email,
      email: me.email,
      role: this.normalizeRole(me.primary_role),
      is_active: me.is_active,
    };
  }

  private normalizeRole(role: string | null | undefined): UserRole {
    const value = (role ?? '').toLowerCase().replace(/[_\s-]/g, '');
    if (value === 'superadmin') return 'superadmin';
    if (value === 'admin') return 'admin';
    return 'technician';
  }

  private clearSession() {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
