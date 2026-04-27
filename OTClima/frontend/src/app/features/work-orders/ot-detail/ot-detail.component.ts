import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { PageShellComponent } from '../../../shared/components/page-shell/page-shell.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ClpCurrencyPipe } from '../../../shared/pipes/clp-currency.pipe';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { WorkOrder, OtStatus, OT_STATUS_STEPS, VALID_TRANSITIONS, OT_STATUS_LABELS, Evidence } from '../../../core/models';

@Component({
  selector: 'app-ot-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatTabsModule,
    PageShellComponent, StatusChipComponent, ClpCurrencyPipe,
  ],
  template: `
    <app-page-shell>
      <!-- Back + header -->
      <div class="detail-header">
        <a routerLink="/work-orders" class="back-link">
          <span class="material-icons">arrow_back</span> Volver
        </a>
        <div class="flex items-center gap-4" *ngIf="ot()">
          <h2>#OT-{{ ot()!.id | number:'4.0-0' }} — {{ ot()!.title }}</h2>
          <app-status-chip [status]="ot()!.status"></app-status-chip>
        </div>
      </div>

      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
      </div>

      <ng-container *ngIf="ot() && !loading()">
        <!-- State stepper -->
        <div class="stepper card mb-6">
          <div *ngFor="let step of steps; let i = index; let last = last" class="step-wrapper">
            <div class="step" [class.done]="isStepDone(step)" [class.current]="ot()!.status === step"
                 [class.rejected]="ot()!.status === 'rejected' && !isStepDone(step)">
              <div class="step-circle">
                <span class="material-icons" *ngIf="isStepDone(step)">check</span>
                <span *ngIf="!isStepDone(step)">{{ i+1 }}</span>
              </div>
              <div class="step-label">{{ statusLabel(step) }}</div>
            </div>
            <div class="step-line" *ngIf="!last" [class.done]="isStepDone(steps[i+1])"></div>
          </div>
          <!-- Rejected badge -->
          <div class="rejected-badge" *ngIf="ot()!.status === 'rejected'">
            <span class="material-icons">cancel</span> OT Rechazada
          </div>
        </div>

        <div class="detail-grid">
          <!-- Left panel -->
          <div class="detail-main">
            <mat-tab-group>
              <!-- Info Tab -->
              <mat-tab label="Información">
                <div class="tab-content">
                  <div class="info-section">
                    <div class="info-label">Cliente</div>
                    <div class="info-value" *ngIf="ot()!.client">
                      <strong>{{ ot()!.client!.name }}</strong>
                      <div class="text-sm text-secondary" *ngIf="ot()!.client!.phone">
                        <span class="material-icons" style="font-size:14px">phone</span> {{ ot()!.client!.phone }}
                      </div>
                      <div class="text-sm text-secondary" *ngIf="ot()!.client!.address">
                        <span class="material-icons" style="font-size:14px">location_on</span> {{ ot()!.client!.address }}
                      </div>
                    </div>
                  </div>

                  <div class="info-section" *ngIf="ot()!.technician">
                    <div class="info-label">Técnico asignado</div>
                    <div class="info-value">{{ ot()!.technician!.name }}</div>
                  </div>

                  <div class="info-section" *ngIf="ot()!.equipment_info">
                    <div class="info-label">Equipo</div>
                    <div class="info-value">{{ ot()!.equipment_info }}</div>
                  </div>

                  <div class="info-section">
                    <div class="info-label">Visita técnica</div>
                    <div class="info-value">{{ visitTypeLabel() }}</div>
                  </div>

                  <div class="info-section" *ngIf="ot()!.diagnosis_notes">
                    <div class="info-label">Diagnóstico</div>
                    <div class="info-value diagnosis-text">{{ ot()!.diagnosis_notes }}</div>
                  </div>

                  <div class="info-section">
                    <div class="info-label">Creada</div>
                    <div class="info-value">{{ ot()!.created_at | date:'dd/MM/yyyy HH:mm' }}</div>
                  </div>
                </div>
              </mat-tab>

              <!-- Quotation Tab -->
              <mat-tab label="Cotización">
                <div class="tab-content">
                  <div *ngIf="ot()!.quotation; else noQuotation">
                    <div class="quotation-items">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Descripción</th>
                            <th>Cant.</th>
                            <th>P. Unit.</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let item of ot()!.quotation!.items">
                            <td>{{ item.description }}</td>
                            <td>{{ item.qty }}</td>
                            <td>{{ item.unit_price | clp }}</td>
                            <td class="font-semibold">{{ item.qty * item.unit_price | clp }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div class="quotation-totals">
                      <div class="total-row">
                        <span>Subtotal</span>
                        <span>{{ ot()!.quotation!.subtotal | clp }}</span>
                      </div>
                      <div class="total-row" *ngIf="ot()!.quotation!.discount">
                        <span>Descuento</span>
                        <span class="text-success">- {{ ot()!.quotation!.discount | clp }}</span>
                      </div>
                      <div class="total-row total-final">
                        <span>TOTAL</span>
                        <span>{{ ot()!.quotation!.total | clp }}</span>
                      </div>
                    </div>
                    <div class="flex gap-3 mt-4">
                      <a [routerLink]="['/work-orders', ot()!.id, 'quotation']">
                        <button class="btn btn-outline btn-sm">
                          <span class="material-icons">edit</span> Editar
                        </button>
                      </a>
                      <a [href]="pdfUrl()" target="_blank">
                        <button class="btn btn-primary btn-sm">
                          <span class="material-icons">picture_as_pdf</span> Descargar PDF
                        </button>
                      </a>
                    </div>
                  </div>
                  <ng-template #noQuotation>
                    <div class="empty-state" style="padding: 32px 0">
                      <span class="material-icons">request_quote</span>
                      <p>Sin cotización aún</p>
                      <a [routerLink]="['/work-orders', ot()!.id, 'quotation']" *ngIf="canEdit()">
                        <button class="btn btn-primary btn-sm mt-4">Crear cotización</button>
                      </a>
                    </div>
                  </ng-template>
                </div>
              </mat-tab>

              <!-- Evidence Tab -->
              <mat-tab label="Evidencias ({{ evidences().length }})">
                <div class="tab-content">
                  <div class="evidence-grid" *ngIf="evidences().length > 0">
                    <div *ngFor="let ev of evidences()" class="evidence-item">
                      <img [src]="ev.url" alt="Evidencia" onerror="this.src='assets/icons/icon-96x96.png'">
                      <div class="evidence-info">
                        <span class="text-xs text-muted">{{ ev.stage === 'diagnosis' ? 'Diagnóstico' : 'Ejecución' }}</span>
                        <span class="text-xs" *ngIf="ev.description">{{ ev.description }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="evidences().length === 0" style="padding:24px 0">
                    <span class="material-icons">photo_library</span>
                    <p>Sin evidencias</p>
                  </div>
                  <div *ngIf="canEdit()">
                    <label class="upload-btn btn btn-outline btn-sm" style="cursor:pointer;margin-top:16px">
                      <span class="material-icons">add_photo_alternate</span> Subir foto
                      <input type="file" accept="image/*" style="display:none" (change)="uploadEvidence($event)">
                    </label>
                  </div>
                </div>
              </mat-tab>

              <!-- Payment Tab -->
              <mat-tab label="Pago">
                <div class="tab-content">
                  <div *ngIf="ot()!.payment">
                    <div class="payment-card">
                      <span class="material-icons text-success" style="font-size:36px">check_circle</span>
                      <div>
                        <div class="info-label">Monto pagado</div>
                        <div style="font-size:22px;font-weight:700;color:var(--color-success)">
                          {{ ot()!.payment!.amount | clp }}
                        </div>
                        <div class="text-sm text-secondary">
                          {{ ot()!.payment!.method }} · {{ ot()!.payment!.paid_at | date:'dd/MM/yyyy' }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div *ngIf="!ot()!.payment && ot()!.status === 'finished'">
                    <div class="empty-state" style="padding:24px 0">
                      <span class="material-icons">payments</span>
                      <p>Pago pendiente</p>
                    </div>
                    <button class="btn btn-primary btn-sm mt-4" (click)="showPaymentDialog()">
                      Registrar pago
                    </button>
                  </div>
                  <div *ngIf="!ot()!.payment && ot()!.status !== 'finished'" class="empty-state" style="padding:24px 0">
                    <span class="material-icons">payments</span>
                    <p>Sin pago registrado</p>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>

          <!-- Right panel: actions -->
          <div class="detail-actions card" *ngIf="transitions().length > 0 || canEdit()">
            <h4 style="margin-bottom:12px">Acciones</h4>

            <a [routerLink]="['/work-orders', ot()!.id, 'quotation']" *ngIf="canEditQuotation()">
              <button class="btn btn-outline w-full mb-4">
                <span class="material-icons">request_quote</span>
                {{ ot()!.quotation ? 'Editar cotización' : 'Crear cotización' }}
              </button>
            </a>

            <ng-container *ngFor="let t of transitions()">
              <button class="btn w-full mb-4"
                      [class.btn-primary]="!isRejection(t)"
                      [class.btn-danger]="isRejection(t)"
                      (click)="doTransition(t)">
                <span class="material-icons">{{ transitionIcon(t) }}</span>
                {{ transitionLabel(t) }}
              </button>
            </ng-container>
          </div>
        </div>
      </ng-container>
    </app-page-shell>
  `,
  styles: [`
    .detail-header {
      margin-bottom: 24px;
      .back-link { display: inline-flex; align-items: center; gap: 4px;
        color: var(--color-text-secondary); text-decoration: none; font-size: 14px;
        margin-bottom: 12px;
        .material-icons { font-size: 18px; }
        &:hover { color: var(--color-primary-600); }
      }
    }
    .spinner {
      width: 36px; height: 36px; border: 3px solid var(--color-border);
      border-top-color: var(--color-primary-500); border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .stepper {
      display: flex; align-items: center; flex-wrap: wrap; gap: 0; padding: 20px 24px;
      position: relative;
    }
    .step-wrapper { display: flex; align-items: center; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 80px; }
    .step-circle {
      width: 32px; height: 32px; border-radius: 50%;
      border: 2px solid var(--color-border);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600; color: var(--color-text-muted);
      background: var(--color-surface);
      .material-icons { font-size: 16px; }
    }
    .step.done .step-circle { background: var(--color-success); border-color: var(--color-success); color: white; }
    .step.current .step-circle { background: var(--color-primary-500); border-color: var(--color-primary-500); color: white; }
    .step-label { font-size: 11px; font-weight: 500; color: var(--color-text-muted); text-align: center; }
    .step.done .step-label, .step.current .step-label { color: var(--color-text-primary); }
    .step-line { flex: 1; height: 2px; background: var(--color-border); min-width: 20px; margin: 0 4px; }
    .step-line.done { background: var(--color-success); }
    .rejected-badge {
      display: flex; align-items: center; gap: 6px;
      margin-left: auto; padding: 6px 14px;
      background: var(--color-error-bg); color: var(--color-error);
      border-radius: var(--radius-full); font-size: 13px; font-weight: 600;
      .material-icons { font-size: 16px; }
    }

    .detail-grid {
      display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start;
    }
    @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }

    .tab-content { padding: 20px 0; }
    .info-section { margin-bottom: 16px; }
    .info-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--color-primary-600); margin-bottom: 4px; }
    .info-value { font-size: 14px; color: var(--color-text-primary); }
    .diagnosis-text { background: var(--color-surface-alt); border-left: 3px solid var(--color-primary-300); padding: 10px 14px; border-radius: 4px; font-size: 14px; }

    .quotation-totals { margin-top: 16px; background: var(--color-surface-alt); border-radius: var(--radius-md); padding: 16px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
    .total-final { font-weight: 700; font-size: 16px; color: var(--color-primary-600); border-top: 2px solid var(--color-primary-200); padding-top: 10px; margin-top: 6px; }

    .evidence-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
    .evidence-item img { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-border); }
    .evidence-info { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }

    .payment-card { display: flex; align-items: center; gap: 16px; background: var(--color-success-bg); border-radius: 12px; padding: 20px; }

    .detail-actions { padding: 20px; position: sticky; top: 20px; }

    .visitTypeLabel { font-size: 13px; }
  `],
})
export class OtDetailComponent implements OnInit {
  ot = signal<WorkOrder | null>(null);
  evidences = signal<Evidence[]>([]);
  loading = signal(true);

  steps = OT_STATUS_STEPS.filter(s => s !== 'rejected');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.load(id);
  }

  load(id: number) {
    this.loading.set(true);
    this.api.getWorkOrder(id).subscribe({
      next: ot => { this.ot.set(ot); this.loading.set(false); this.loadEvidences(id); },
      error: () => { this.loading.set(false); this.router.navigate(['/work-orders']); },
    });
  }

  loadEvidences(id: number) {
    this.api.getEvidences(id).subscribe({ next: ev => this.evidences.set(ev) });
  }

  isStepDone(step: OtStatus): boolean {
    const current = this.ot()?.status;
    if (!current) return false;
    if (current === 'rejected') return false;
    const idx = OT_STATUS_STEPS.indexOf(step);
    const cur = OT_STATUS_STEPS.indexOf(current as OtStatus);
    return cur > idx;
  }

  transitions(): OtStatus[] {
    const status = this.ot()?.status as OtStatus;
    return VALID_TRANSITIONS[status] ?? [];
  }

  isRejection(t: OtStatus) { return t === 'rejected'; }

  canEdit(): boolean {
    const s = this.ot()?.status;
    return s !== 'paid' && s !== 'rejected';
  }

  canEditQuotation(): boolean {
    const s = this.ot()?.status;
    return s === 'diagnosis' || s === 'quotation_sent';
  }

  statusLabel(s: string): string {
    return OT_STATUS_LABELS[s as OtStatus] ?? s;
  }

  transitionLabel(t: OtStatus): string {
    const map: Record<OtStatus, string> = {
      quotation_sent: 'Enviar cotización',
      approved: 'Marcar aprobada',
      in_execution: 'Iniciar ejecución',
      finished: 'Marcar finalizada',
      paid: 'Registrar pago',
      rejected: 'Rechazar OT',
      diagnosis: '',
    };
    return map[t];
  }

  transitionIcon(t: OtStatus): string {
    const map: Record<OtStatus, string> = {
      quotation_sent: 'send', approved: 'thumb_up', in_execution: 'build',
      finished: 'done_all', paid: 'payments', rejected: 'cancel', diagnosis: 'search',
    };
    return map[t];
  }

  visitTypeLabel(): string {
    const vt = this.ot()?.visit_type;
    const vc = this.ot()?.visit_cost ?? 0;
    if (vt === 'free') return 'Sin costo';
    if (vt === 'charged') return `Cobrada — $${vc.toLocaleString('es-CL')}`;
    if (vt === 'charged_deductible') return `Cobrada y descontable — $${vc.toLocaleString('es-CL')}`;
    return '';
  }

  pdfUrl(): string {
    return this.ot() ? this.api.getPdfUrl(this.ot()!.id) : '';
  }

  doTransition(newStatus: OtStatus) {
    if (newStatus === 'paid') { this.showPaymentDialog(); return; }
    const label = this.transitionLabel(newStatus);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: '¿Confirmar acción?', message: `${label} — ¿seguro?`, confirmText: label, danger: newStatus === 'rejected' }
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.transitionOt(this.ot()!.id, newStatus).subscribe({
        next: ot => { this.ot.set(ot); this.snack.open('Estado actualizado', '', { duration: 2500 }); },
        error: () => this.snack.open('Error al cambiar estado', '', { duration: 3000 }),
      });
    });
  }

  showPaymentDialog() {
    const amount = this.ot()?.quotation?.total ?? 0;
    const method = prompt(`Monto a pagar (sugerido: $${amount.toLocaleString('es-CL')})`, String(amount));
    if (!method) return;
    const paymentMethod = prompt('Método (transferencia, efectivo, cheque)', 'transferencia') ?? 'transferencia';
    this.api.registerPayment(this.ot()!.id, { amount: Number(method), method: paymentMethod }).subscribe({
      next: () => {
        this.snack.open('Pago registrado', '', { duration: 2500 });
        this.load(this.ot()!.id);
      },
      error: () => this.snack.open('Error al registrar pago', '', { duration: 3000 }),
    });
  }

  uploadEvidence(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadEvidence(this.ot()!.id, file, '', 'execution').subscribe({
      next: () => { this.snack.open('Foto subida', '', { duration: 2000 }); this.loadEvidences(this.ot()!.id); },
      error: () => this.snack.open('Error al subir foto', '', { duration: 3000 }),
    });
  }
}
