import { Component, OnInit, signal, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-tech-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Nuevo técnico</h2>
    <mat-dialog-content>
      <form [formGroup]="form" style="display:flex;flex-direction:column;gap:4px;min-width:360px;padding:8px 0">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="name">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contraseña temporal</mat-label>
          <input matInput formControlName="password" type="password">
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="ref.close(form.value)" [disabled]="form.invalid">Crear</button>
    </mat-dialog-actions>
  `,
})
export class TechFormDialog {
  form = this.fb.group({
    name:     ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  constructor(
    public ref: MatDialogRef<TechFormDialog>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}
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
          <button class="btn btn-ghost btn-sm" (click)="toggleActive(t)">
            <span class="material-icons">{{ t.is_active ? 'block' : 'check_circle' }}</span>
          </button>
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
    .tech-info { flex: 1; }
    .tech-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
    .tech-stats { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
    .stat-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary); .material-icons { font-size: 13px; } }
    .status-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; &.active { background: var(--color-success-bg); color: var(--color-success); } &.inactive { background: var(--color-error-bg); color: var(--color-error); } }
  `],
})
export class TechniciansComponent implements OnInit {
  techs   = signal<any[]>([]);
  loading = signal(true);

  constructor(private api: ApiService, private dialog: MatDialog, private snack: MatSnackBar) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.getTechnicians().subscribe({
      next: t => { this.techs.set(t); this.loading.set(false); },
    });
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  }

  openForm() {
    const ref = this.dialog.open(TechFormDialog, { data: null, width: '400px' });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.api.createTechnician(result).subscribe({
        next: () => { this.snack.open('Técnico creado', '', { duration: 2500 }); this.load(); },
        error: () => this.snack.open('Error al crear técnico', '', { duration: 3000 }),
      });
    });
  }

  toggleActive(t: any) {
    this.api.toggleTechnicianActive(t.id).subscribe({
      next: () => { this.snack.open('Estado actualizado', '', { duration: 2000 }); this.load(); },
    });
  }
}
