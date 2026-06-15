import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { ClpCurrencyPipe } from '../../shared/pipes/clp-currency.pipe';
import { WorkOrdersService } from '../../core/services/work-orders.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, PageShellComponent, StatusChipComponent, ClpCurrencyPipe],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Reportes</h2>
          <div class="subtitle">Historial completo de órdenes de trabajo</div>
        </div>
        <button class="btn btn-outline" (click)="exportCsv()">
          <span class="material-icons">download</span> Exportar CSV
        </button>
      </div>

      <div class="loading-overlay" *ngIf="loading()"><div class="spinner"></div></div>

      <div class="card" *ngIf="!loading()">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>#OT</th>
                <th>Título</th>
                <th>Cliente</th>
                <th>Técnico</th>
                <th>Estado</th>
                <th>Total cotizado</th>
                <th>Pago recibido</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of rows()">
                <td class="text-muted font-medium">#{{ r.id }}</td>
                <td>{{ r.title }}</td>
                <td>{{ r.client }}</td>
                <td>{{ r.technician || '—' }}</td>
                <td><app-status-chip [status]="r.status"></app-status-chip></td>
                <td class="text-right">{{ r.total | clp }}</td>
                <td class="text-right font-semibold text-success" *ngIf="r.paid_amount">{{ r.paid_amount | clp }}</td>
                <td *ngIf="!r.paid_amount" class="text-muted text-right">—</td>
                <td class="text-muted">{{ r.created_at | date:'dd/MM/yyyy' }}</td>
              </tr>
              <tr *ngIf="rows().length === 0">
                <td colspan="8" class="text-center text-muted" style="padding:40px">Sin datos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary-500); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .table-wrapper { overflow-x: auto; }
  `],
})
export class ReportsComponent implements OnInit {
  rows    = signal<any[]>([]);
  loading = signal(true);

  constructor(private workOrdersService: WorkOrdersService) {}

  ngOnInit() {
    this.workOrdersService.exportOts().subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exportCsv() {
    const headers = ['ID', 'Título', 'Cliente', 'Técnico', 'Estado', 'Total', 'Pagado', 'Fecha'];
    const csvRows = this.rows().map(r =>
      [r.id, `"${r.title}"`, `"${r.client}"`, `"${r.technician}"`,
       r.status, r.total, r.paid_amount, r.created_at.split('T')[0]].join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'otclima-reporte.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
