import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  TechnicianCreatePayload,
  TechniciansService,
  TechnicianUpdatePayload,
} from '../../core/services/technicians.service';
import { Technician } from '../../core/models';

@Component({
  selector: 'app-tech-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, ModalShellComponent],
  template: `
    <app-modal-shell [title]="data ? 'Editar técnico' : 'Nuevo técnico'">
      <form modal-body [formGroup]="form" class="tech-form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="name">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Teléfono</mat-label>
          <input matInput formControlName="phone">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ data ? 'Nueva contraseña (opcional)' : 'Contraseña temporal' }}</mat-label>
          <input matInput formControlName="password" type="password">
        </mat-form-field>
      </form>

      <div modal-actions>
        <button type="button" class="btn btn-ghost" (click)="ref.close()">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="save()" [disabled]="form.invalid">
          {{ data ? 'Guardar' : 'Crear' }}
        </button>
      </div>
    </app-modal-shell>
  `,
  styles: [`
    .tech-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: min(100%, 440px);
    }

    [modal-actions] {
      display: flex;
      gap: 10px;
    }

    @media (max-width: 480px) {
      [modal-actions] {
        width: 100%;
        flex-direction: column-reverse;
      }

      [modal-actions] .btn {
        width: 100%;
      }
    }
  `],
})
export class TechFormDialog {
  form = this.fb.group({
    name: [this.data?.name ?? '', Validators.required],
    email: [this.data?.email ?? '', [Validators.required, Validators.email]],
    phone: [this.data?.phone ?? ''],
    password: ['', this.data ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    public ref: MatDialogRef<TechFormDialog>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: Technician | null,
  ) {}

  save() {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const payload: TechnicianCreatePayload | TechnicianUpdatePayload = {
      name: value.name ?? '',
      email: value.email ?? '',
      phone: value.phone ?? '',
      password: value.password || undefined,
    };

    this.ref.close(payload);
  }
}

@Component({
  selector: 'app-technicians',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatSnackBarModule, PageShellComponent],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Técnicos</h2>
          <div class="subtitle">{{ techs().length }} técnicos registrados</div>
        </div>
        <button class="btn btn-primary" (click)="openForm()">
          <span class="material-icons">add</span> Nuevo técnico
        </button>
      </div>

      <div class="loading-overlay" *ngIf="loading()"><div class="spinner"></div></div>

      <div class="empty-state" *ngIf="!loading() && techs().length === 0">
        <span class="material-icons">engineering</span>
        <h3>Sin técnicos</h3>
        <p>Crea el primer técnico del equipo</p>
      </div>

      <div class="tech-grid" *ngIf="!loading() && techs().length > 0">
        <div *ngFor="let t of techs()" class="tech-card card">
          <div class="tech-avatar" [class.inactive]="!t.is_active">
            {{ initials(t.name) }}
          </div>

          <div class="tech-info">
            <div class="tech-name">{{ t.name }}</div>
            <div class="text-sm text-secondary">{{ t.email }}</div>
            <div class="text-sm text-secondary" *ngIf="t.phone">{{ t.phone }}</div>
            <div class="tech-stats">
              <span class="stat-badge">
                <span class="material-icons">assignment</span>
                {{ t.active_ots }} OTs activas
              </span>
              <span class="status-badge" [class.active]="t.is_active" [class.inactive]="!t.is_active">
                {{ t.is_active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
          </div>

          <div class="tech-actions">
            <button class="icon-btn" type="button" title="Editar técnico" (click)="openForm(t)">
              <span class="material-icons">edit</span>
            </button>
            <button class="icon-btn" type="button" [title]="t.is_active ? 'Desactivar técnico' : 'Activar técnico'" (click)="toggleActive(t)">
              <span class="material-icons">{{ t.is_active ? 'block' : 'check_circle' }}</span>
            </button>
            <button class="icon-btn danger" type="button" title="Eliminar técnico" (click)="deactivateTechnician(t)">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary-500); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .tech-grid { display: flex; flex-direction: column; gap: 12px; }
    .tech-card { display: flex; align-items: center; gap: 14px; padding: 16px 20px; }
    .tech-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--color-primary-100); color: var(--color-primary-700); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0; &.inactive { background: var(--color-border); color: var(--color-text-muted); } }
    .tech-info { flex: 1; min-width: 0; }
    .tech-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; color: var(--color-text-primary); }
    .tech-stats { display: flex; gap: 10px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
    .stat-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary); .material-icons { font-size: 13px; } }
    .status-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; &.active { background: var(--color-success-bg); color: var(--color-success); } &.inactive { background: var(--color-error-bg); color: var(--color-error); } }
    .tech-actions { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .icon-btn { width: 34px; height: 34px; border: 0; border-radius: 50%; background: transparent; color: var(--color-text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .icon-btn .material-icons { font-size: 18px; }
    .icon-btn:hover { background: var(--color-surface-alt); color: var(--color-text-primary); }
    .icon-btn.danger:hover { color: var(--color-error); background: var(--color-error-bg); }
    @media (max-width: 620px) {
      .tech-card { align-items: flex-start; flex-wrap: wrap; }
      .tech-actions { width: 100%; justify-content: flex-end; }
    }
  `],
})
export class TechniciansComponent implements OnInit {
  techs = signal<Technician[]>([]);
  loading = signal(true);

  constructor(
    private techniciansService: TechniciansService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.techniciansService.getTechnicians().subscribe({
      next: (technicians) => {
        this.techs.set(technicians);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(this.errorMessage(error, 'cargar técnicos'), '', { duration: 3000 });
      },
    });
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  }

  openForm(technician?: Technician) {
    const ref = this.dialog.open(TechFormDialog, {
      data: technician ?? null,
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'ot-modal-panel',
    });

    ref.afterClosed().subscribe((result?: TechnicianCreatePayload | TechnicianUpdatePayload) => {
      if (!result) return;

      const request = technician
        ? this.techniciansService.updateTechnician(technician.id, result)
        : this.techniciansService.createTechnician(result as TechnicianCreatePayload);

      request.subscribe({
        next: () => {
          this.snack.open(technician ? 'Técnico actualizado' : 'Técnico creado', '', { duration: 2500 });
          this.load();
        },
        error: (error: HttpErrorResponse) => this.snack.open(this.errorMessage(error, 'guardar técnico'), '', { duration: 3000 }),
      });
    });
  }

  toggleActive(technician: Technician) {
    this.techniciansService.toggleTechnicianActive(technician.id).subscribe({
      next: () => {
        this.snack.open('Estado actualizado', '', { duration: 2000 });
        this.load();
      },
      error: (error: HttpErrorResponse) => this.snack.open(this.errorMessage(error, 'actualizar estado'), '', { duration: 3000 }),
    });
  }

  deactivateTechnician(technician: Technician) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: `¿Estás seguro de que deseas eliminar el registro de ${technician.name}?`,
        confirmText: 'Eliminar',
        danger: true,
      },
      width: '420px',
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.techniciansService.deactivateTechnician(technician.id).subscribe({
        next: () => {
          this.snack.open('Técnico desactivado', '', { duration: 2500 });
          this.load();
        },
        error: (error: HttpErrorResponse) => this.snack.open(this.errorMessage(error, 'eliminar técnico'), '', { duration: 3000 }),
      });
    });
  }

  private errorMessage(error: HttpErrorResponse, action: string): string {
    if (error.status === 401) return 'Tu sesión expiró, vuelve a iniciar sesión';
    if (error.status === 403) return 'No tienes permisos para esta acción';
    if (error.status === 404) return 'Técnico no encontrado';
    if (error.status === 409) return 'Ya existe un usuario con ese email';
    if (error.status === 422) return 'Revisa los campos del formulario';
    return `Error al ${action}`;
  }
}
