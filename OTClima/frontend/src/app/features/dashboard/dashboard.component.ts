import { Component, OnInit, signal, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { ClpCurrencyPipe } from '../../shared/pipes/clp-currency.pipe';
import { DashboardSummary } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';
import { Chart, registerables } from 'chart.js';
import { WorkOrdersService } from '../../core/services/work-orders.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    PageShellComponent, KpiCardComponent, StatusChipComponent, ClpCurrencyPipe,
  ],
  template: `
    <app-page-shell>
      <div class="section-header">
        <div>
          <h2>Dashboard</h2>
          <div class="subtitle">Bienvenido, {{ auth.currentUser()?.name }}</div>
        </div>
        <a routerLink="/work-orders/new">
          <button class="btn btn-primary">
            <span class="material-icons">add</span> Nueva OT
          </button>
        </a>
      </div>

      <!-- KPIs -->
      <div class="grid-4 mb-6" *ngIf="summary()">
        <app-kpi-card
          label="OTs Activas"
          [value]="summary()!.active_ots"
          icon="assignment"
          iconColor="var(--color-primary-600)"
          iconBg="var(--color-primary-100)">
        </app-kpi-card>
        <app-kpi-card
          label="Cotizaciones pendientes"
          [value]="summary()!.pending_quotations"
          icon="request_quote"
          iconColor="var(--color-warning)"
          iconBg="var(--color-warning-bg)">
        </app-kpi-card>
        <app-kpi-card
          label="Ingresos del mes"
          [value]="summary()!.monthly_revenue | clp"
          icon="payments"
          iconColor="var(--color-success)"
          iconBg="var(--color-success-bg)">
        </app-kpi-card>
        <app-kpi-card
          label="Tasa de aprobación"
          [value]="summary()!.approval_rate + '%'"
          sub="sobre OTs cerradas"
          icon="trending_up"
          iconColor="var(--color-info)"
          iconBg="var(--color-info-bg)">
        </app-kpi-card>
      </div>

      <!-- Charts + Recent -->
      <div class="dashboard-grid" *ngIf="summary()">
        <!-- Bar chart -->
        <div class="card">
          <h3 style="margin-bottom:16px">Ingresos últimos 6 meses</h3>
          <canvas #revenueChart height="200"></canvas>
        </div>

        <!-- Donut chart -->
        <div class="card">
          <h3 style="margin-bottom:16px">OTs por estado</h3>
          <canvas #statusChart height="200"></canvas>
        </div>
      </div>

      <!-- Recent OTs -->
      <div class="card mt-4" *ngIf="summary()">
        <div class="flex items-center justify-between mb-4">
          <h3>OTs recientes</h3>
          <a routerLink="/work-orders" class="text-sm text-primary">Ver todas →</a>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th><th>Título</th><th>Estado</th><th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let ot of summary()!.recent_ots" style="cursor:pointer"
                [routerLink]="['/work-orders', ot.id]">
              <td class="text-muted">#{{ ot.id }}</td>
              <td class="font-medium">{{ ot.title }}</td>
              <td><app-status-chip [status]="ot.status"></app-status-chip></td>
              <td class="text-muted">{{ ot.created_at | date:'dd/MM/yyyy' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
      </div>
    </app-page-shell>
  `,
  styles: [`
    .dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .dashboard-grid { grid-template-columns: 1fr; } }
    .mb-6 { margin-bottom: 24px; }
    .mt-4 { margin-top: 16px; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary-500); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart')  statusChartRef!: ElementRef<HTMLCanvasElement>;

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);

  constructor(private workOrdersService: WorkOrdersService, public auth: AuthService) {}

  ngOnInit() {
    this.workOrdersService.getDashboardSummary().subscribe({
      next: s => {
        this.summary.set(s);
        this.loading.set(false);
        setTimeout(() => this.renderCharts(), 50);
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit() {}

  renderCharts() {
    const s = this.summary()!;

    // Revenue bar chart
    if (this.revenueChartRef) {
      new Chart(this.revenueChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: s.monthly_revenue_chart.map(r => r.month),
          datasets: [{
            label: 'Ingresos CLP',
            data: s.monthly_revenue_chart.map(r => r.total),
            backgroundColor: '#0EA5E9',
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: v => '$' + Number(v).toLocaleString('es-CL') } } },
        },
      });
    }

    // Status donut chart
    if (this.statusChartRef) {
      const colors: Record<string, string> = {
        diagnosis: '#8B5CF6', quotation_sent: '#F59E0B', approved: '#3B82F6',
        in_execution: '#6366F1', finished: '#10B981', paid: '#059669', rejected: '#EF4444',
      };
      const labels: Record<string, string> = {
        diagnosis: 'Diagnóstico', quotation_sent: 'Cot. enviada', approved: 'Aprobada',
        in_execution: 'En ejecución', finished: 'Finalizada', paid: 'Pagada', rejected: 'Rechazada',
      };
      new Chart(this.statusChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: s.ot_by_status.map(o => labels[o.status] ?? o.status),
          datasets: [{
            data: s.ot_by_status.map(o => o.count),
            backgroundColor: s.ot_by_status.map(o => colors[o.status] ?? '#94A3B8'),
            borderWidth: 2,
          }],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    }
  }
}
