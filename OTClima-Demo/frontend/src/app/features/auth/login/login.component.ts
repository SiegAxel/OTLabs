import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-page">
      <div class="login-bg">
        <div class="bg-circles">
          <div class="circle c1"></div>
          <div class="circle c2"></div>
          <div class="circle c3"></div>
        </div>
      </div>

      <div class="login-card">
        <!-- Brand -->
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons">ac_unit</span>
          </div>
          <div class="brand-text">
            <h1>OTClima</h1>
            <p>Gestión de Órdenes de Trabajo</p>
          </div>
        </div>

        <div class="card-divider"></div>

        <h2 class="form-title">Iniciar sesión</h2>
        <p class="form-subtitle">Ingresa con tu cuenta para continuar</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Correo electrónico</mat-label>
            <input matInput formControlName="email" type="email" placeholder="tu@empresa.cl">
            <mat-icon matPrefix>email</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Contraseña</mat-label>
            <input matInput formControlName="password"
              [type]="showPassword() ? 'text' : 'password'" placeholder="••••••••">
            <mat-icon matPrefix>lock</mat-icon>
            <button type="button" mat-icon-button matSuffix (click)="togglePassword()">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <div class="error-msg" *ngIf="error()">
            <span class="material-icons">error_outline</span>
            {{ error() }}
          </div>

          <button type="submit" mat-flat-button color="primary"
                  class="submit-btn" [disabled]="loading()">
            <mat-spinner diameter="18" *ngIf="loading()"></mat-spinner>
            <span *ngIf="!loading()">Ingresar</span>
          </button>
        </form>

        <div class="demo-hint">
          <span class="material-icons">info</span>
          <div>
            <strong>Demo:</strong> admin&#64;otclima.cl / demo1234<br>
            <span class="text-xs">También: carlos&#64;otclima.cl (técnico)</span>
          </div>
        </div>

        <div class="powered-by">Powered by <strong>OTLabs</strong></div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      background: linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0EA5E9 100%);
      padding: 24px;
    }

    .login-bg {
      position: absolute; inset: 0; overflow: hidden; pointer-events: none;
    }

    .bg-circles .circle {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,.05);
    }
    .c1 { width: 400px; height: 400px; top: -100px; right: -80px; }
    .c2 { width: 250px; height: 250px; bottom: -60px; left: -60px; }
    .c3 { width: 150px; height: 150px; top: 50%; left: 20%; }

    .login-card {
      position: relative; z-index: 1;
      background: white;
      border-radius: 20px;
      padding: 40px;
      width: 100%; max-width: 420px;
      box-shadow: 0 24px 48px rgb(0 0 0 / 0.2);
    }

    .brand {
      display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
    }
    .brand-icon {
      width: 52px; height: 52px;
      background: linear-gradient(135deg, #0EA5E9, #0369A1);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      .material-icons { color: white; font-size: 28px; }
    }
    .brand-text h1 { font-size: 24px; font-weight: 800; color: var(--color-primary-900); line-height: 1; }
    .brand-text p  { font-size: 12px; color: var(--color-text-secondary); margin-top: 3px; }

    .card-divider { height: 1px; background: var(--color-border); margin-bottom: 24px; }

    .form-title    { font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 4px; }
    .form-subtitle { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 20px; }

    .login-form {
      display: flex; flex-direction: column; gap: 8px;
      mat-form-field { width: 100%; }
    }

    .error-msg {
      display: flex; align-items: center; gap: 8px;
      background: var(--color-error-bg);
      color: var(--color-error);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px; font-weight: 500;
      .material-icons { font-size: 18px; }
    }

    .submit-btn {
      width: 100%; height: 48px;
      font-size: 15px; font-weight: 600;
      margin-top: 8px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }

    .demo-hint {
      margin-top: 20px;
      background: var(--color-primary-50);
      border: 1px solid var(--color-primary-100);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex; gap: 10px; align-items: flex-start;
      font-size: 12px; color: var(--color-text-secondary);
      .material-icons { font-size: 16px; color: var(--color-primary-500); margin-top: 1px; flex-shrink: 0; }
      strong { color: var(--color-primary-700); }
    }

    .powered-by {
      text-align: center; margin-top: 20px;
      font-size: 11px; color: var(--color-text-muted);
      strong { color: var(--color-primary-600); }
    }
  `],
})
export class LoginComponent {
  form = this.fb.group({
    email:    ['admin@otclima.cl', [Validators.required, Validators.email]],
    password: ['demo1234', Validators.required],
  });
  loading = signal(false);
  error   = signal('');
  showPassword = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {}

  togglePassword() { this.showPassword.update(v => !v); }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => { this.loading.set(false); this.router.navigate(['/dashboard']); },
      error: () => { this.loading.set(false); this.error.set('Credenciales incorrectas. Intenta nuevamente.'); },
    });
  }
}
