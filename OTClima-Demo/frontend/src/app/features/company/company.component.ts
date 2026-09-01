import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { ApiService } from '../../core/services/api.service';
import { Company } from '../../core/models';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule,
    PageShellComponent,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Perfil de Empresa</h2>
          <div class="subtitle">Datos que aparecen en las cotizaciones PDF</div>
        </div>
      </div>

      <div class="company-layout">
        <div class="card">
          <form [formGroup]="form" (ngSubmit)="save()" class="company-form">
            <h3 style="margin-bottom:16px">Datos generales</h3>
            <div class="form-row-2">
              <mat-form-field appearance="outline">
                <mat-label>Nombre empresa *</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>RUT empresa</mat-label>
                <input matInput formControlName="rut">
              </mat-form-field>
            </div>
            <div class="form-row-2">
              <mat-form-field appearance="outline">
                <mat-label>Teléfono</mat-label>
                <input matInput formControlName="phone">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email">
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Dirección</mat-label>
              <input matInput formControlName="address">
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Condiciones comerciales (para PDF)</mat-label>
              <textarea matInput formControlName="quote_conditions" rows="3"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Garantía estándar (para PDF)</mat-label>
              <textarea matInput formControlName="quote_warranty" rows="2"></textarea>
            </mat-form-field>
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                <span class="material-icons">save</span>
                {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            </div>
          </form>
        </div>

        <div class="card logo-panel">
          <h3 style="margin-bottom:16px">Logo de empresa</h3>
          <div class="logo-preview" *ngIf="company()?.logo_path">
            <img [src]="logoUrl()" alt="Logo" class="logo-img">
          </div>
          <div class="logo-placeholder" *ngIf="!company()?.logo_path">
            <span class="material-icons">business</span>
            <p class="text-muted text-sm">Sin logo cargado</p>
          </div>
          <label class="btn btn-outline w-full" style="cursor:pointer;margin-top:16px;text-align:center;display:flex;justify-content:center">
            <span class="material-icons">upload</span> Subir logo
            <input type="file" accept="image/*" style="display:none" (change)="uploadLogo($event)">
          </label>
          <p class="text-xs text-muted" style="margin-top:8px;text-align:center">PNG, JPG o SVG · Max 2MB</p>

          <hr class="divider">
          <div class="plan-badge">
            <span class="material-icons">verified</span>
            Plan {{ company()?.plan_type | uppercase }}
          </div>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .company-layout { display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .company-layout { grid-template-columns: 1fr; } }
    .company-form { display: flex; flex-direction: column; gap: 4px; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .logo-panel { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 20px; }
    .logo-preview { display: flex; justify-content: center; padding: 16px; background: var(--color-surface-alt); border-radius: 10px; }
    .logo-img { max-height: 100px; max-width: 100%; object-fit: contain; }
    .logo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; background: var(--color-surface-alt); border-radius: 10px; border: 2px dashed var(--color-border); .material-icons { font-size: 40px; color: var(--color-border-strong); } }
    .plan-badge { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--color-primary-600); .material-icons { font-size: 18px; color: var(--color-accent-500); } }
  `],
})
export class CompanyComponent implements OnInit {
  company = signal<Company | null>(null);
  saving  = signal(false);

  form = this.fb.group({
    name:             [''],
    rut:              [''],
    phone:            [''],
    email:            [''],
    address:          [''],
    quote_conditions: [''],
    quote_warranty:   [''],
  });

  constructor(private fb: FormBuilder, private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit() {
    this.api.getCompany().subscribe(c => {
      this.company.set(c);
      this.form.patchValue(c as any);
    });
  }

  logoUrl(): string {
    const p = this.company()?.logo_path;
    if (!p) return '';
    return `http://localhost:8000/uploads/${p.split('/uploads/').pop()}`;
  }

  save() {
    this.saving.set(true);
    this.api.updateCompany(this.form.value as any).subscribe({
      next: c => { this.company.set(c); this.saving.set(false); this.snack.open('Empresa actualizada', '', { duration: 2500 }); },
      error: () => { this.saving.set(false); this.snack.open('Error al guardar', '', { duration: 3000 }); },
    });
  }

  uploadLogo(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadLogo(file).subscribe({
      next: c => { this.company.set(c); this.snack.open('Logo actualizado', '', { duration: 2500 }); },
      error: () => this.snack.open('Error al subir logo', '', { duration: 3000 }),
    });
  }
}
