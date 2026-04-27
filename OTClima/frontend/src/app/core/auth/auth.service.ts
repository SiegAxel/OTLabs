import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'otclima_token';
  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<{ access_token: string }>(
      `${environment.apiUrl}/auth/login`,
      { email, password }
    ).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        this.loadCurrentUser();
      })
    );
  }

  loadCurrentUser() {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap(user => this.currentUser.set(user))
    ).subscribe({ error: () => this.logout() });
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }
}
