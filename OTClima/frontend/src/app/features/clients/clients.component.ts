import { Component, OnInit, signal, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-client-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, ModalShellComponent],
  template: `
    <app-modal-shell [title]="data ? 'Editar cliente' : 'Nuevo cliente'">
      <form modal-body [formGroup]="form" class="client-form">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Nombre *</mat-label>
          <input matInput formControlName="nombre">
        </mat-form-field>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>RUT *</mat-label>
            <input matInput formControlName="rut" placeholder="12.345.678-9">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Teléfono</mat-label>
            <input matInput formControlName="telefono">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Dirección</mat-label>
          <input matInput formControlName="direccion">
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Notas</mat-label>
          <textarea matInput formControlName="notas" rows="2"></textarea>
        </mat-form-field>
      </form>
      <div modal-actions>
      <button mat-button (click)="ref.close()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="ref.close(form.value)" [disabled]="form.invalid">Guardar</button>
      </div>
    </app-modal-shell>
  `,
  styles: [`
    .client-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: min(100%, 440px);
    }

    .row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    [modal-actions] {
      display: flex;
      gap: 10px;
    }

    @media (max-width: 600px) {
      .row-2 {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
  `],
})
export class ClientFormDialog {
  form = this.fb.group({
    nombre:   [this.data?.nombre ?? '', Validators.required],
    rut:      [this.data?.rut ?? '', Validators.required],
    telefono: [this.data?.telefono ?? ''],
    email:    [this.data?.email ?? '', Validators.email],
    direccion:[this.data?.direccion ?? ''],
    notas:    [this.data?.notas ?? ''],
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
          <div class="client-avatar">{{ initials(c.nombre) }}</div>
          <div class="client-info">
            <div class="client-name">{{ c.nombre }}</div>
            <div class="client-detail" *ngIf="c.rut">
              <span class="material-icons">badge</span>{{ c.rut }}
            </div>
            <div class="client-detail" *ngIf="c.telefono">
              <span class="material-icons">phone</span>{{ c.telefono }}
            </div>
            <div class="client-detail" *ngIf="c.email">
              <span class="material-icons">email</span>{{ c.email }}
            </div>
            <div class="client-detail" *ngIf="c.direccion">
              <span class="material-icons">location_on</span>{{ c.direccion }}
            </div>
          </div>
          <button class="icon-btn danger" type="button" title="Eliminar cliente" (click)="deleteClient(c, $event)">
            <span class="material-icons">delete</span>
          </button>
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
    .client-card { display: flex; align-items: flex-start; gap: 14px; padding: 18px; position: relative; }
    .client-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--color-primary-100); color: var(--color-primary-700); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }
    .client-info { flex: 1; min-width: 0; }
    .client-name { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--color-text-primary); }
    .client-detail { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 3px; .material-icons { font-size: 13px; color: var(--color-primary-400); } }
    .icon-btn { width: 34px; height: 34px; border: 0; border-radius: 50%; background: transparent; color: var(--color-text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
    .icon-btn .material-icons { font-size: 18px; }
    .icon-btn:hover { background: var(--color-surface, #f8fafc); color: var(--color-text-primary); }
    .icon-btn.danger:hover { color: var(--color-danger-600, #dc2626); background: rgba(220, 38, 38, .08); }
  `],
})
export class ClientsComponent implements OnInit {
  clients  = signal<Client[]>([]);
  filtered = signal<Client[]>([]);
  loading  = signal(true);
  q = '';

  constructor(
    private clientsService: ClientsService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.clientsService.getClients().subscribe({
      next: c => { this.clients.set(c); this.filter(); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open('Error al cargar clientes', '', { duration: 3000 }); },
    });
  }

  filter() {
    const s = this.q.toLowerCase();
    this.filtered.set(
      s
        ? this.clients().filter((c) =>
            [c.nombre, c.rut, c.telefono, c.email, c.direccion]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(s)),
          )
        : this.clients(),
    );
  }

  initials(nombre: string): string {
    return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  openForm(client?: Client) {
    const ref = this.dialog.open(ClientFormDialog, {
      data: client ?? null,
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'ot-modal-panel',
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const req = client ? this.clientsService.updateClient(client.id, result) : this.clientsService.createClient(result);
      req.subscribe({
        next: () => { this.snack.open(client ? 'Cliente actualizado' : 'Cliente creado', '', { duration: 2500 }); this.load(); },
        error: (error: HttpErrorResponse) => this.snack.open(this.errorMessage(error, 'guardar'), '', { duration: 3000 }),
      });
    });
  }

  deleteClient(client: Client, event: MouseEvent) {
    event.stopPropagation();
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar cliente',
        message: `Esto eliminará a ${client.nombre}.`,
        confirmText: 'Eliminar',
        danger: true,
      },
      width: '420px',
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.loading.set(true);
      this.clientsService.deleteClient(client.id).subscribe({
        next: () => {
          this.snack.open('Cliente eliminado', '', { duration: 2500 });
          this.load();
        },
        error: () => {
          this.loading.set(false);
          this.snack.open('Error al eliminar cliente', '', { duration: 3000 });
        },
      });
    });
  }

  private errorMessage(error: HttpErrorResponse, action: string): string {
    if (error.status === 409) return 'Ya existe un cliente con ese RUT';
    if (error.status === 422) return 'Revisa los campos obligatorios';
    if (error.status === 403) return 'No tienes permisos para esta acción';
    return `Error al ${action}`;
  }
}
