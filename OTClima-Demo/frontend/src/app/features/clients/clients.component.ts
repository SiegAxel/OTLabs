import { Component, OnInit, signal, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { ApiService } from '../../core/services/api.service';
import { Client } from '../../core/models';

@Component({
  selector: 'app-client-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar cliente' : 'Nuevo cliente' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="client-form">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Nombre *</mat-label>
          <input matInput formControlName="name">
        </mat-form-field>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>RUT</mat-label>
            <input matInput formControlName="rut" placeholder="12.345.678-9">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Teléfono</mat-label>
            <input matInput formControlName="phone">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Dirección</mat-label>
          <input matInput formControlName="address">
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Notas</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="ref.close(form.value)" [disabled]="form.invalid">Guardar</button>
    </mat-dialog-actions>
  `,
  styles: [`.client-form { display: flex; flex-direction: column; gap: 4px; min-width: 400px; padding: 8px 0; } .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }`],
})
export class ClientFormDialog {
  form = this.fb.group({
    name:    [this.data?.name ?? '', Validators.required],
    rut:     [this.data?.rut ?? ''],
    phone:   [this.data?.phone ?? ''],
    email:   [this.data?.email ?? ''],
    address: [this.data?.address ?? ''],
    notes:   [this.data?.notes ?? ''],
  });
  constructor(
    public ref: MatDialogRef<ClientFormDialog>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: Client | null,
  ) {}
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatSnackBarModule,
    PageShellComponent,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Clientes</h2>
          <div class="subtitle">{{ filtered().length }} clientes registrados</div>
        </div>
        <button class="btn btn-primary" (click)="openForm()">
          <span class="material-icons">add</span> Nuevo cliente
        </button>
      </div>

      <div class="search-bar">
        <span class="material-icons">search</span>
        <input [(ngModel)]="q" (ngModelChange)="filter()" placeholder="Buscar cliente..." class="search-input">
      </div>

      <div class="loading-overlay" *ngIf="loading()"><div class="spinner"></div></div>

      <div class="empty-state" *ngIf="!loading() && filtered().length === 0">
        <span class="material-icons">people</span>
        <h3>Sin clientes</h3>
        <p>Crea el primer cliente para comenzar</p>
        <button class="btn btn-primary mt-4" (click)="openForm()">Crear cliente</button>
      </div>

      <div class="clients-grid" *ngIf="!loading() && filtered().length > 0">
        <div *ngFor="let c of filtered()" class="client-card card card-hover" (click)="openForm(c)">
          <div class="client-avatar">{{ initials(c.name) }}</div>
          <div class="client-info">
            <div class="client-name">{{ c.name }}</div>
            <div class="client-detail" *ngIf="c.rut">
              <span class="material-icons">badge</span>{{ c.rut }}
            </div>
            <div class="client-detail" *ngIf="c.phone">
              <span class="material-icons">phone</span>{{ c.phone }}
            </div>
            <div class="client-detail" *ngIf="c.email">
              <span class="material-icons">email</span>{{ c.email }}
            </div>
            <div class="client-detail" *ngIf="c.address">
              <span class="material-icons">location_on</span>{{ c.address }}
            </div>
          </div>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .search-bar { display: flex; align-items: center; gap: 10px; background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 20px; .material-icons { color: var(--color-text-muted); } }
    .search-input { border: none; outline: none; flex: 1; font-family: 'Inter', sans-serif; font-size: 14px; background: transparent; color: var(--color-text-primary); }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary-500); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .clients-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .client-card { display: flex; align-items: flex-start; gap: 14px; padding: 18px; }
    .client-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--color-primary-100); color: var(--color-primary-700); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }
    .client-info { flex: 1; min-width: 0; }
    .client-name { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--color-text-primary); }
    .client-detail { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 3px; .material-icons { font-size: 13px; color: var(--color-primary-400); } }
  `],
})
export class ClientsComponent implements OnInit {
  clients  = signal<Client[]>([]);
  filtered = signal<Client[]>([]);
  loading  = signal(true);
  q = '';

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getClients().subscribe({
      next: c => { this.clients.set(c); this.filter(); this.loading.set(false); },
    });
  }

  filter() {
    const s = this.q.toLowerCase();
    this.filtered.set(s ? this.clients().filter(c => c.name.toLowerCase().includes(s)) : this.clients());
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  openForm(client?: Client) {
    const ref = this.dialog.open(ClientFormDialog, { data: client ?? null, width: '480px' });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const req = client ? this.api.updateClient(client.id, result) : this.api.createClient(result);
      req.subscribe({
        next: () => { this.snack.open(client ? 'Cliente actualizado' : 'Cliente creado', '', { duration: 2500 }); this.load(); },
        error: () => this.snack.open('Error al guardar', '', { duration: 3000 }),
      });
    });
  }
}
