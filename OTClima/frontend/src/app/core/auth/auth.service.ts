import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface MeResponse {
  id: number;
  username: string;
  email: string;
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
    return this.me().subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.logout(),
    });
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
    return this.currentUser()?.role === 'admin';
  }

  private me() {
    return this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(map((me) => this.mapMeToUser(me)));
  }

  private mapMeToUser(me: MeResponse): User {
    return {
      id: me.id,
      company_id: 1,
      name: me.username || me.email,
      email: me.email,
      role: me.primary_role?.toLowerCase() === 'admin' ? 'admin' : 'technician',
      is_active: me.is_active,
    };
  }

  private clearSession() {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
