import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageShellComponent } from '../../../shared/components/page-shell/page-shell.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';
import { ClpCurrencyPipe } from '../../../shared/pipes/clp-currency.pipe';
import { ApiService } from '../../../core/services/api.service';
import { WorkOrder, OtStatus, OT_STATUS_LABELS } from '../../../core/models';

@Component({
  selector: 'app-ot-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    PageShellComponent, StatusChipComponent, StatusLabelPipe, ClpCurrencyPipe,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Órdenes de Trabajo</h2>
          <div class="subtitle">{{ filtered().length }} OTs encontradas</div>
        </div>
        <a routerLink="/work-orders/new">
          <button class="btn btn-primary">
            <span class="material-icons">add</span> Nueva OT
          </button>
        </a>
      </div>

      <!-- Filtros por estado -->
      <div class="filters">
        <button class="filter-chip" [class.active]="activeFilter() === ''"
                (click)="setFilter('')">Todas ({{ ots().length }})</button>
        <button *ngFor="let s of statuses" class="filter-chip" [class.active]="activeFilter() === s"
                (click)="setFilter(s)">
          {{ statusLabel(s) }} ({{ countByStatus(s) }})
        </button>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <span class="material-icons">search</span>
        <input [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()"
               placeholder="Buscar por cliente o título..." class="search-input">
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
      </div>

      <!-- Empty -->
      <div class="empty-state" *ngIf="!loading() && filtered().length === 0">
        <span class="material-icons">assignment</span>
        <h3>Sin órdenes de trabajo</h3>
        <p>Crea la primera OT para empezar</p>
        <a routerLink="/work-orders/new">
          <button class="btn btn-primary mt-4">Crear OT</button>
        </a>
      </div>

      <!-- List -->
      <div class="ot-grid" *ngIf="!loading() && filtered().length > 0">
        <a *ngFor="let ot of filtered()" [routerLink]="['/work-orders', ot.id]" class="ot-card-link">
          <div class="ot-card card card-hover">
            <div class="ot-card-header">
              <div class="ot-number text-xs text-muted">#OT-{{ ot.id | number:'4.0-0' }}</div>
              <app-status-chip [status]="ot.status"></app-status-chip>
            </div>
            <h3 class="ot-title">{{ ot.title }}</h3>
            <div class="ot-client" *ngIf="ot.client">
              <span class="material-icons">person</span> {{ ot.client.name }}
            </div>
            <div class="ot-technician" *ngIf="ot.technician">
              <span class="material-icons">engineering</span> {{ ot.technician.name }}
            </div>
            <div class="ot-card-footer">
              <span class="text-xs text-muted">{{ ot.created_at | date:'dd/MM/yyyy' }}</span>
              <span class="text-sm font-semibold text-primary" *ngIf="ot.quotation">
                {{ ot.quotation.total | clp }}
              </span>
            </div>
          </div>
        </a>
      </div>

      <!-- FAB mobile -->
      <a routerLink="/work-orders/new" class="fab">
        <span class="material-icons">add</span>
      </a>
    </app-page-shell>
  `,
  styles: [`
    .filters {
      display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
    }
    .filter-chip {
      padding: 6px 14px; border-radius: 20px;
      border: 1.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: all .12s;
      &.active { border-color: var(--color-primary-500); background: var(--color-primary-50); color: var(--color-primary-700); }
      &:hover { border-color: var(--color-primary-300); }
    }
    .search-bar {
      display: flex; align-items: center; gap: 10px;
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      margin-bottom: 20px;
      .material-icons { color: var(--color-text-muted); }
    }
    .search-input {
      border: none; outline: none; flex: 1;
      font-family: 'Inter', sans-serif; font-size: 14px;
      background: transparent; color: var(--color-text-primary);
    }
    .spinner {
      width: 36px; height: 36px; border: 3px solid var(--color-border);
      border-top-color: var(--color-primary-500); border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    .ot-card-link { text-decoration: none; }
    .ot-card {
      padding: 18px 20px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .ot-card-header {
      display: flex; align-items: center; justify-content: space-between;
    }
    .ot-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); line-height: 1.3; }
    .ot-client, .ot-technician {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--color-text-secondary);
      .material-icons { font-size: 15px; }
    }
    .ot-card-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 4px; padding-top: 10px;
      border-top: 1px solid var(--color-border);
    }
    .fab {
      display: none;
      position: fixed; bottom: 80px; right: 20px; z-index: 90;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--color-primary-500);
      color: white; text-decoration: none;
      align-items: center; justify-content: center;
      box-shadow: var(--shadow-lg);
      .material-icons { font-size: 24px; }
    }
    @media (max-width: 768px) {
      .fab { display: flex; }
      section-header button { display: none; }
    }
  `],
})
export class OtListComponent implements OnInit {
  ots = signal<WorkOrder[]>([]);
  filtered = signal<WorkOrder[]>([]);
  loading = signal(true);
  activeFilter = signal('');
  searchQuery = '';

  statuses: OtStatus[] = ['diagnosis', 'quotation_sent', 'approved', 'in_execution', 'finished', 'paid', 'rejected'];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getWorkOrders().subscribe({
      next: ots => { this.ots.set(ots); this.applyFilters(); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setFilter(status: string) {
    this.activeFilter.set(status);
    this.applyFilters();
  }

  applyFilters() {
    let result = this.ots();
    if (this.activeFilter()) result = result.filter(o => o.status === this.activeFilter());
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.client?.name.toLowerCase().includes(q)
      );
    }
    this.filtered.set(result);
  }

  countByStatus(status: OtStatus): number {
    return this.ots().filter(o => o.status === status).length;
  }

  statusLabel(s: string): string {
    return OT_STATUS_LABELS[s as OtStatus] ?? s;
  }
}
