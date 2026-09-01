import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageShellComponent } from '../../../shared/components/page-shell/page-shell.component';
import { ApiService } from '../../../core/services/api.service';
import { Client, User } from '../../../core/models';

@Component({
  selector: 'app-ot-new',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatSnackBarModule,
    PageShellComponent,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <a routerLink="/work-orders" class="back-link">
            <span class="material-icons">arrow_back</span> Volver
          </a>
          <h2 class="mt-4">Nueva Orden de Trabajo</h2>
        </div>
      </div>

      <div class="form-card card" style="max-width:640px">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-grid">
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Título / descripción del trabajo</mat-label>
            <input matInput formControlName="title" placeholder="Ej: Mantención preventiva equipo split">
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Cliente</mat-label>
            <mat-select formControlName="client_id">
              <mat-option *ngFor="let c of clients()" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Técnico asignado</mat-label>
            <mat-select formControlName="technician_id">
              <mat-option [value]="null">Sin asignar</mat-option>
              <mat-option *ngFor="let t of technicians()" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Equipo / modelo</mat-label>
            <input matInput formControlName="equipment_info" placeholder="Ej: Split 18.000 BTU Samsung">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo de visita</mat-label>
            <mat-select formControlName="visit_type">
              <mat-option value="free">Sin costo</mat-option>
              <mat-option value="charged">Cobrada</mat-option>
              <mat-option value="charged_deductible">Cobrada y descontable</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" *ngIf="form.value.visit_type !== 'free'">
            <mat-label>Costo visita (CLP)</mat-label>
            <input matInput type="number" formControlName="visit_cost">
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Diagnóstico inicial (opcional)</mat-label>
            <textarea matInput formControlName="diagnosis_notes" rows="3"
              placeholder="Describe el problema detectado..."></textarea>
          </mat-form-field>

          <div class="form-actions span-2">
            <a routerLink="/work-orders">
              <button type="button" class="btn btn-ghost">Cancelar</button>
            </a>
            <button type="submit" class="btn btn-primary" [disabled]="loading() || form.invalid">
              <span class="material-icons" *ngIf="!loading()">add</span>
              {{ loading() ? 'Creando...' : 'Crear OT' }}
            </button>
          </div>
        </form>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-secondary); text-decoration: none; font-size: 14px; .material-icons { font-size: 18px; } &:hover { color: var(--color-primary-600); } }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .span-2 { grid-column: span 2; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px; }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } }
  `],
})
export class OtNewComponent implements OnInit {
  form = this.fb.group({
    title:           ['', Validators.required],
    client_id:       [null, Validators.required],
    technician_id:   [null],
    equipment_info:  [''],
    visit_type:      ['free'],
    visit_cost:      [0],
    diagnosis_notes: [''],
  });
  clients    = signal<Client[]>([]);
  technicians = signal<User[]>([]);
  loading    = signal(false);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.api.getClients().subscribe(c => this.clients.set(c));
    this.api.getTechnicians().subscribe(t => this.technicians.set(t));
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.api.createWorkOrder(this.form.value as any).subscribe({
      next: ot => { this.router.navigate(['/work-orders', ot.id]); },
      error: () => { this.loading.set(false); this.snack.open('Error al crear OT', '', { duration: 3000 }); },
    });
  }
}
