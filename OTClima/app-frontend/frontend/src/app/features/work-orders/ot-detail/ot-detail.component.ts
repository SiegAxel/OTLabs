import { AfterViewChecked, Component, ElementRef, HostListener, Inject, OnInit, QueryList, ViewChild, ViewChildren, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PageShellComponent } from '../../../shared/components/page-shell/page-shell.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ClpCurrencyPipe } from '../../../shared/pipes/clp-currency.pipe';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalShellComponent } from '../../../shared/components/modal-shell/modal-shell.component';
import { WorkOrder, OtStatus, OT_STATUS_STEPS, VALID_TRANSITIONS, OT_STATUS_LABELS, Evidence, WorkOrderStatusMovement } from '../../../core/models';
import { PaymentPayload, WorkOrdersService } from '../../../core/services/work-orders.service';
import { CompanyService } from '../../../core/services/company.service';
import { CommercialTextOption, CommercialTextsService } from '../../../core/services/commercial-texts.service';
import { formatMovementDate, movementForStatus, movementTitle } from '../../../core/utils/work-order-history';

type StepperStatus = Exclude<OtStatus, 'rejected'>;

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
        <div class="detail-title-row" *ngIf="ot()">
          <h2>#OT-{{ ot()!.id | number:'4.0-0' }} — {{ ot()!.title }}</h2>
          <app-status-chip [status]="ot()!.status"></app-status-chip>
        </div>
      </div>

      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
      </div>

      <ng-container *ngIf="ot() && !loading()">
        <!-- State stepper -->
        <div class="stepper-shell mb-6">
          <button type="button" class="stepper-arrow stepper-arrow-left" aria-label="Estado anterior" (click)="scrollStateStepper(-1)">
            <span class="material-icons">chevron_left</span>
          </button>

          <div #stateStepper class="stepper card">
            <div #stepItem *ngFor="let step of steps; let i = index; let last = last" class="step-wrapper">
              <div class="step"
                   [class.done]="isStepDone(step)"
                   [class.current]="ot()!.status === step"
                   [class.rejected]="ot()!.status === 'rejected' && !isStepDone(step)"
                   [class.detail-open]="openedMovementStatus() === step"
                   tabindex="0"
                   role="button"
                   (click)="toggleMovementDetail(step)"
                   (keydown.enter)="toggleMovementDetail(step)"
                   (keydown.space)="toggleMovementDetail(step)"
                   (blur)="closeMovementDetail(step)">
                <div class="step-circle">
                  <span class="material-icons" *ngIf="isStepDone(step)">check</span>
                  <span *ngIf="!isStepDone(step)">{{ i+1 }}</span>
                </div>
                <div class="step-label">{{ statusLabel(step) }}</div>
              </div>
              <div class="step-line" *ngIf="!last" [class.done]="isStepDone(steps[i+1])"></div>
            </div>
            <!-- Rejected badge -->
            <div #rejectedItem class="rejected-badge"
                 *ngIf="ot()!.status === 'rejected'"
                 [class.detail-open]="openedMovementStatus() === 'rejected'"
                 tabindex="0"
                 role="button"
                 (click)="toggleMovementDetail('rejected')"
                 (keydown.enter)="toggleMovementDetail('rejected')"
                 (keydown.space)="toggleMovementDetail('rejected')">
              <span class="material-icons">cancel</span> OT Rechazada
            </div>
          </div>

          <button type="button" class="stepper-arrow stepper-arrow-right" aria-label="Estado siguiente" (click)="scrollStateStepper(1)">
            <span class="material-icons">chevron_right</span>
          </button>
        </div>

        <div class="movement-modal-backdrop" *ngIf="openedMovementStatus()" (click)="openedMovementStatus.set(null)">
          <div class="movement-detail-modal"
               role="dialog"
               aria-modal="true"
               [attr.data-status]="openedMovementStatus()"
               (click)="$event.stopPropagation()">
            <button type="button" class="movement-modal-close" (click)="openedMovementStatus.set(null)" aria-label="Cerrar detalle">
              <span class="material-icons">close</span>
            </button>
            <div class="movement-modal-header">
              <span class="movement-modal-icon material-icons">{{ historyIcon(openedMovementStatus()!) }}</span>
              <div>
                <span class="movement-modal-eyebrow">Etapa seleccionada</span>
                <h3>{{ statusLabel(openedMovementStatus()!) }}</h3>
              </div>
            </div>

            <ng-container *ngIf="selectedMovement() as movement; else noMovement">
              <div class="movement-transition">{{ movementTitle(movement) }}</div>
              <div class="movement-modal-user">
                <span class="material-icons">person</span>
                <div>
                  <strong>{{ movement.changed_by.name || 'Usuario no disponible' }}</strong>
                  <span *ngIf="movement.changed_by.email">{{ movement.changed_by.email }}</span>
                </div>
              </div>
              <div class="movement-modal-date">
                <span class="material-icons">schedule</span>
                <time [attr.datetime]="movement.created_at">{{ formatMovementDate(movement.created_at) }}</time>
              </div>
            </ng-container>

            <ng-template #noMovement>
              <div class="movement-modal-empty">
                <span class="material-icons">history</span>
                <p>No hay un movimiento registrado para esta etapa.</p>
              </div>
            </ng-template>

          </div>
        </div>

        <div class="evidence-lightbox"
             *ngIf="selectedEvidence() as evidence"
             role="dialog"
             aria-modal="true"
             aria-label="Vista ampliada de evidencia"
             (click)="closeEvidencePreview()">
          <button type="button"
                  class="evidence-lightbox-close"
                  aria-label="Cerrar imagen"
                  (click)="closeEvidencePreview()">
            <span class="material-icons">close</span>
          </button>
          <figure (click)="$event.stopPropagation()">
            <img [src]="evidence.url"
                 [alt]="evidence.description || 'Evidencia ampliada'"
                 onerror="this.src='assets/icons/icon-512x512.png'">
            <figcaption *ngIf="evidence.description">{{ evidence.description }}</figcaption>
          </figure>
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
                      <strong>{{ ot()!.client!.nombre }}</strong>
                      <div class="text-sm text-secondary" *ngIf="ot()!.client!.telefono">
                        <span class="material-icons" style="font-size:14px">phone</span> {{ ot()!.client!.telefono }}
                      </div>
                      <div class="text-sm text-secondary" *ngIf="ot()!.client!.direccion">
                        <span class="material-icons" style="font-size:14px">location_on</span> {{ ot()!.client!.direccion }}
                      </div>
                    </div>
                  </div>

                  <div class="info-section" *ngIf="ot()!.technician">
                    <div class="info-label">Responsable operativo</div>
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
                    <div class="quotation-items table-scroll">
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
                    <div class="quotation-commercial-texts"
                         *ngIf="ot()!.quotation!.conditions || ot()!.quotation!.warranty">
                      <section class="quotation-commercial-block" *ngIf="ot()!.quotation!.conditions">
                        <div class="commercial-text-head">
                          <h4>Condiciones comerciales</h4>
                          <span class="commercial-origin" [attr.data-origin]="quotationTextOrigin('conditions')">
                            {{ quotationTextOriginLabel('conditions') }}
                          </span>
                        </div>
                        <div class="commercial-text-content" [innerHTML]="ot()!.quotation!.conditions"></div>
                      </section>
                      <section class="quotation-commercial-block" *ngIf="ot()!.quotation!.warranty">
                        <div class="commercial-text-head">
                          <h4>Garantía</h4>
                          <span class="commercial-origin" [attr.data-origin]="quotationTextOrigin('warranties')">
                            {{ quotationTextOriginLabel('warranties') }}
                          </span>
                        </div>
                        <div class="commercial-text-content" [innerHTML]="ot()!.quotation!.warranty"></div>
                      </section>
                    </div>
                    <div class="flex gap-3 mt-4">
                      <a [routerLink]="['/work-orders', ot()!.id, 'quotation']" *ngIf="canEditQuotation()">
                        <button class="btn btn-outline btn-sm">
                          <span class="material-icons">edit</span> Editar
                        </button>
                      </a>
                      <button class="btn btn-primary btn-sm" type="button" (click)="downloadPdf()">
                          <span class="material-icons">picture_as_pdf</span> Descargar PDF
                      </button>
                    </div>
                  </div>
                  <ng-template #noQuotation>
                    <div class="empty-state" style="padding: 32px 0">
                      <span class="material-icons">request_quote</span>
                      <p>Sin cotización aún</p>
                      <a [routerLink]="['/work-orders', ot()!.id, 'quotation']" *ngIf="canEditQuotation()">
                        <button class="btn btn-primary btn-sm mt-4">Crear cotización</button>
                      </a>
                    </div>
                  </ng-template>
                </div>
              </mat-tab>

              <!-- Evidence Tab -->
              <mat-tab label="Evidencias ({{ evidences().length }})">
                <div class="tab-content evidence-tab">
                  <div class="evidence-tab-head">
                    <div>
                      <h3>Evidencias de la orden</h3>
                      <p>La etapa y el responsable se asignan automáticamente al subir cada archivo.</p>
                    </div>
                    <label class="btn btn-outline btn-sm evidence-upload">
                      <span class="material-icons">add_photo_alternate</span> Subir evidencia
                      <input type="file" accept="image/*" (change)="uploadEvidence($event)">
                    </label>
                  </div>

                  <div class="stage-evidence-grid evidence-tab-grid" *ngIf="evidences().length; else noEvidences">
                    <article class="stage-evidence-card"
                             *ngFor="let evidence of evidences(); trackBy: trackEvidence">
                      <button type="button"
                              class="evidence-preview-button"
                              (click)="openEvidencePreview(evidence)"
                              [attr.aria-label]="'Ampliar ' + (evidence.description || 'evidencia')">
                        <img [src]="evidence.url"
                             [alt]="evidence.description || 'Evidencia de ' + statusLabel(evidence.stage)"
                             onerror="this.src='assets/icons/icon-96x96.png'">
                        <span class="evidence-zoom material-icons">zoom_in</span>
                      </button>
                      <div class="stage-evidence-info">
                        <span class="evidence-stage" [attr.data-status]="evidence.stage">
                          {{ statusLabel(evidence.stage) }}
                        </span>
                        <strong *ngIf="evidence.description">{{ evidence.description }}</strong>
                        <span>Subida por: {{ evidence.uploaded_by?.name || 'Usuario no disponible' }}</span>
                        <small *ngIf="evidence.uploaded_by?.email">{{ evidence.uploaded_by?.email }}</small>
                        <time [attr.datetime]="evidence.uploaded_at">{{ formatMovementDate(evidence.uploaded_at) }}</time>
                      </div>
                      <button type="button"
                              class="evidence-delete"
                              *ngIf="canEdit()"
                              (click)="deleteEvidence(evidence)"
                              aria-label="Eliminar evidencia">
                        <span class="material-icons">delete</span>
                      </button>
                    </article>
                  </div>

                  <ng-template #noEvidences>
                    <div class="stage-evidences-empty evidence-tab-empty">
                      <span class="material-icons">photo_library</span>
                      <p>Aún no hay evidencias en esta orden.</p>
                    </div>
                  </ng-template>
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
    .detail-title-row {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }
    .detail-title-row h2 {
      min-width: 0;
      overflow-wrap: anywhere;
      line-height: 1.25;
    }
    .spinner {
      width: 36px; height: 36px; border: 3px solid var(--color-border);
      border-top-color: var(--color-primary-500); border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .stepper-shell {
      position: relative;
    }
    .stepper-arrow {
      display: none;
      position: absolute;
      top: 50%;
      z-index: 2;
      width: 34px;
      height: 34px;
      border: 1px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-primary-600);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      transform: translateY(-50%);
    }
    .stepper-arrow:hover {
      background: var(--color-primary-50);
      border-color: var(--color-primary-300);
    }
    .stepper-arrow .material-icons {
      font-size: 22px;
    }
    .stepper-arrow-left { left: 6px; }
    .stepper-arrow-right { right: 6px; }

    .stepper {
      display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px 0; padding: 20px 24px;
      position: relative;
    }
    .step-wrapper { display: flex; align-items: center; min-width: 0; }
    .step {
      display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 80px;
      position: relative;
      cursor: pointer;
      border-radius: 8px;
      outline: none;
    }
    .step:focus-visible {
      box-shadow: 0 0 0 3px var(--color-primary-100);
    }
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
    .step.detail-open { background: var(--color-primary-50); box-shadow: 0 0 0 3px var(--color-primary-200); }
    .step.detail-open .step-circle { transform: scale(1.08); box-shadow: 0 0 0 4px var(--color-primary-100); }
    .step.detail-open .step-label { color: var(--color-primary-700); font-weight: 700; }
    .step-label { font-size: 11px; font-weight: 500; color: var(--color-text-muted); text-align: center; white-space: nowrap; }
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
    .rejected-badge.detail-open { box-shadow: 0 0 0 3px var(--status-rejected-bg); outline: 2px solid var(--status-rejected); }

    .detail-grid {
      display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start;
    }
    @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }
    .detail-main { min-width: 0; }

    .tab-content { padding: 20px 0; }
    .info-section { margin-bottom: 16px; }
    .info-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--color-primary-600); margin-bottom: 4px; }
    .info-value { font-size: 14px; color: var(--color-text-primary); }
    .diagnosis-text { background: var(--color-surface-alt); border-left: 3px solid var(--color-primary-300); padding: 10px 14px; border-radius: 4px; font-size: 14px; }

    .quotation-items .data-table { min-width: 560px; }
    .quotation-totals { margin-top: 16px; background: var(--color-surface-alt); border-radius: var(--radius-md); padding: 16px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
    .total-final { font-weight: 700; font-size: 16px; color: var(--color-primary-600); border-top: 2px solid var(--color-primary-200); padding-top: 10px; margin-top: 6px; }
    .quotation-commercial-texts { display: grid; gap: 12px; margin-top: 16px; }
    .quotation-commercial-block { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; background: var(--color-surface); }
    .commercial-text-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .commercial-text-head h4 { margin: 0; color: var(--color-text-primary); font-size: 14px; }
    .commercial-origin { flex-shrink: 0; border-radius: var(--radius-full); padding: 3px 9px; font-size: 11px; font-weight: 700; background: var(--color-primary-100); color: var(--color-primary-700); }
    .commercial-origin[data-origin="custom"] { background: var(--color-warning-bg); color: #92400e; }
    .commercial-origin[data-origin="saved"] { background: var(--color-info-bg); color: var(--color-info); }
    .commercial-text-content { color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
    .commercial-text-content :first-child { margin-top: 0; }
    .commercial-text-content :last-child { margin-bottom: 0; }

    .payment-card { display: flex; align-items: center; gap: 16px; background: var(--color-success-bg); border-radius: 12px; padding: 20px; }

    .detail-actions { padding: 20px; position: sticky; top: 20px; }

    .visitTypeLabel { font-size: 13px; }
    @media (max-width: 700px) {
      .detail-title-row {
        align-items: flex-start;
        flex-direction: column;
        gap: 10px;
      }
      .stepper-shell {
        padding: 0 40px;
      }
      .stepper-arrow {
        display: inline-flex;
      }
      .stepper-arrow-left { left: 0; }
      .stepper-arrow-right { right: 0; }
      .stepper {
        display: flex;
        flex-wrap: nowrap;
        justify-content: flex-start;
        gap: 0;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 16px 12px 18px;
        scroll-behavior: smooth;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
      }
      .stepper::-webkit-scrollbar {
        display: none;
      }
      .step-wrapper {
        flex: 0 0 auto;
        justify-content: center;
        scroll-snap-align: center;
      }
      .step {
        align-items: center;
        min-width: 84px;
      }
      .step-label {
        text-align: center;
      }
      .step-line {
        display: block;
        min-width: 18px;
        flex: 0 0 18px;
      }
      .rejected-badge {
        flex: 0 0 auto;
        margin-left: 0;
        width: fit-content;
        scroll-snap-align: center;
      }
      .detail-actions {
        position: static;
      }
      .commercial-text-head {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `],
})
export class OtDetailComponent implements OnInit, AfterViewChecked {
  @ViewChild('stateStepper') stateStepper?: ElementRef<HTMLElement>;
  @ViewChildren('stepItem') stepItems!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('rejectedItem') rejectedItem?: ElementRef<HTMLElement>;

  ot = signal<WorkOrder | null>(null);
  evidences = signal<Evidence[]>([]);
  selectedEvidence = signal<Evidence | null>(null);
  loading = signal(true);
  openedMovementStatus = signal<OtStatus | null>(null);
  conditionOptions = signal<CommercialTextOption[]>([]);
  warrantyOptions = signal<CommercialTextOption[]>([]);
  private lastCenteredStatus = '';

  steps: StepperStatus[] = OT_STATUS_STEPS.filter((s): s is StepperStatus => s !== 'rejected');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workOrdersService: WorkOrdersService,
    private companyService: CompanyService,
    private commercialTexts: CommercialTextsService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadCommercialOptions();
    this.load(id);
  }

  quotationTextOrigin(kind: 'conditions' | 'warranties'): 'default' | 'saved' | 'custom' {
    const quotation = this.ot()?.quotation;
    const content = kind === 'conditions' ? quotation?.conditions : quotation?.warranty;
    const options = kind === 'conditions' ? this.conditionOptions() : this.warrantyOptions();
    const selected = options.find((option) => this.sameHtml(option.content, content ?? ''));
    if (!selected) return 'custom';
    return selected.isDefault ? 'default' : 'saved';
  }

  quotationTextOriginLabel(kind: 'conditions' | 'warranties'): string {
    const origin = this.quotationTextOrigin(kind);
    if (origin === 'default') return 'Predeterminada';
    if (origin === 'saved') return 'Opción guardada';
    return 'Personalizada para esta cotización';
  }

  private loadCommercialOptions() {
    this.companyService.getCompany().subscribe({
      next: (company) => {
        this.conditionOptions.set(this.commercialTexts.activeOptions('conditions', company));
        this.warrantyOptions.set(this.commercialTexts.activeOptions('warranties', company));
      },
    });
  }

  private sameHtml(a: string, b: string): boolean {
    const normalize = (value: string) => (value ?? '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
    return normalize(a) === normalize(b);
  }

  ngAfterViewChecked() {
    this.centerActiveStepOnMobile();
  }

  load(id: number) {
    this.loading.set(true);
    this.workOrdersService.getWorkOrder(id).subscribe({
      next: ot => { this.ot.set(ot); this.loading.set(false); this.loadEvidences(id); },
      error: () => { this.loading.set(false); this.router.navigate(['/work-orders']); },
    });
  }

  loadEvidences(id: number) {
    this.workOrdersService.getEvidences(id).subscribe({ next: ev => this.evidences.set(ev) });
  }

  scrollStateStepper(direction: -1 | 1) {
    const el = this.stateStepper?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.7, 120), behavior: 'smooth' });
  }

  private centerActiveStepOnMobile() {
    if (typeof window === 'undefined' || window.innerWidth > 700) return;

    const status = this.ot()?.status;
    if (!status || status === this.lastCenteredStatus) return;

    const target = status === 'rejected'
      ? this.rejectedItem?.nativeElement
      : this.stepItems?.get(this.steps.indexOf(status))?.nativeElement;

    if (!target) return;
    this.lastCenteredStatus = status;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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

  movementDetail(status: OtStatus): string {
    const movement = movementForStatus(this.ot()?.status_history ?? [], status);
    if (!movement) return 'No hay un movimiento registrado para este estado.';
    const user = movement.changed_by?.name || 'Usuario no disponible';
    return `Movimiento registrado el ${formatMovementDate(movement.created_at)} por ${user}.`;
  }

  selectedMovement(): WorkOrderStatusMovement | undefined {
    const status = this.openedMovementStatus();
    return status ? movementForStatus(this.ot()?.status_history ?? [], status) : undefined;
  }

  trackEvidence(_: number, evidence: Evidence): number {
    return evidence.id;
  }

  openEvidencePreview(evidence: Evidence) {
    this.selectedEvidence.set(evidence);
  }

  closeEvidencePreview() {
    this.selectedEvidence.set(null);
  }

  @HostListener('document:keydown.escape')
  closeEvidencePreviewOnEscape() {
    this.closeEvidencePreview();
  }

  movementTitle(movement: WorkOrderStatusMovement): string {
    return movementTitle(movement);
  }

  formatMovementDate(value: string): string {
    return formatMovementDate(value);
  }

  historyIcon(status: OtStatus): string {
    const icons: Record<OtStatus, string> = {
      diagnosis: 'search',
      quotation_sent: 'send',
      approved: 'thumb_up',
      in_execution: 'build',
      finished: 'done_all',
      paid: 'payments',
      rejected: 'cancel',
    };
    return icons[status];
  }

  toggleMovementDetail(status: OtStatus) {
    this.openedMovementStatus.update((current) => (current === status ? null : status));
  }

  closeMovementDetail(status: OtStatus) {
    if (this.openedMovementStatus() === status) this.openedMovementStatus.set(null);
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

  doTransition(newStatus: OtStatus) {
    if (newStatus === 'paid') { this.showPaymentDialog(); return; }
    const label = this.transitionLabel(newStatus);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { message: `¿Estás seguro de que deseas ${label.toLowerCase()}?`, confirmText: label, danger: newStatus === 'rejected' }
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      const request = newStatus === 'quotation_sent'
        ? this.workOrdersService.markQuotationSent(this.ot()!.id)
        : this.workOrdersService.transitionOt(this.ot()!.id, newStatus);
      request.subscribe({
        next: () => {
          this.snack.open('Estado actualizado', '', { duration: 2500 });
          this.load(this.ot()!.id);
        },
        error: () => this.snack.open('Error al cambiar estado', '', { duration: 3000 }),
      });
    });
  }

  showPaymentDialog() {
    const workOrder = this.ot();
    if (!workOrder) return;

    const ref = this.dialog.open(PaymentDialogComponent, {
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'ot-modal-panel',
      data: { suggestedAmount: workOrder.quotation?.total ?? 0 } satisfies PaymentDialogData,
    });

    ref.afterClosed().subscribe((payment?: PaymentPayload) => {
      if (!payment) return;
      this.workOrdersService.registerPayment(workOrder.id, payment).subscribe({
        next: () => {
          this.snack.open('Pago registrado', '', { duration: 2500 });
          this.load(workOrder.id);
        },
        error: () => this.snack.open('Error al registrar pago', '', { duration: 3000 }),
      });
    });
  }

  uploadEvidence(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const workOrderId = this.ot()!.id;
    this.workOrdersService.uploadEvidence(workOrderId, file, '').subscribe({
      next: () => {
        input.value = '';
        this.snack.open('Evidencia subida', '', { duration: 2000 });
        this.loadEvidences(workOrderId);
      },
      error: () => this.snack.open('Error al subir foto', '', { duration: 3000 }),
    });
  }

  deleteEvidence(evidence: Evidence) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: '¿Deseas eliminar esta evidencia? Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      const workOrderId = this.ot()!.id;
      this.workOrdersService.deleteEvidence(evidence.id).subscribe({
        next: () => {
          this.snack.open('Evidencia eliminada', '', { duration: 2000 });
          this.loadEvidences(workOrderId);
        },
        error: () => this.snack.open('Error al eliminar evidencia', '', { duration: 3000 }),
      });
    });
  }

  downloadPdf() {
    const workOrder = this.ot();
    if (!workOrder) return;

    this.workOrdersService.getPdf(workOrder.id).subscribe({
      next: (blob) => this.openBlob(blob, `OT-${String(workOrder.id).padStart(4, '0')}.txt`),
      error: () => this.snack.open('Error al descargar cotización', '', { duration: 3000 }),
    });
  }

  private openBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

interface PaymentDialogData {
  suggestedAmount: number;
}

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    ModalShellComponent, ClpCurrencyPipe,
  ],
  template: `
    <app-modal-shell title="Registrar pago">
      <form modal-body [formGroup]="form" id="payment-form" (ngSubmit)="submit()">
        <div class="payment-dialog-intro">
          <span class="material-icons">payments</span>
          <div>
            <strong>Confirma los datos del pago</strong>
            <p *ngIf="data.suggestedAmount > 0">Total cotizado: {{ data.suggestedAmount | clp }}</p>
          </div>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Monto pagado</mat-label>
          <span matPrefix>$&nbsp;</span>
          <input matInput type="number" min="1" step="1" formControlName="amount" autocomplete="off">
          <mat-error *ngIf="form.controls.amount.hasError('required')">Ingresa el monto pagado</mat-error>
          <mat-error *ngIf="form.controls.amount.hasError('min')">El monto debe ser mayor que cero</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Método de pago</mat-label>
          <mat-select formControlName="method">
            <mat-option value="transferencia">Transferencia</mat-option>
            <mat-option value="efectivo">Efectivo</mat-option>
            <mat-option value="tarjeta">Tarjeta</mat-option>
            <mat-option value="cheque">Cheque</mat-option>
            <mat-option value="otro">Otro</mat-option>
          </mat-select>
          <mat-error>Selecciona un método de pago</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Observaciones (opcional)</mat-label>
          <textarea matInput rows="3" maxlength="500" formControlName="notes"
                    placeholder="Número de operación, referencia u otra información"></textarea>
          <mat-hint align="end">{{ form.controls.notes.value?.length ?? 0 }}/500</mat-hint>
        </mat-form-field>
      </form>

      <ng-container modal-actions>
        <button type="button" class="btn btn-ghost" (click)="cancel()">Cancelar</button>
        <button type="submit" form="payment-form" class="btn btn-primary" [disabled]="form.invalid">
          <span class="material-icons">check_circle</span> Registrar pago
        </button>
      </ng-container>
    </app-modal-shell>
  `,
  styles: [`
    form { display: flex; flex-direction: column; gap: 4px; }
    mat-form-field { width: 100%; }
    .payment-dialog-intro { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding: 12px 14px; border: 1px solid var(--color-success); border-radius: var(--radius-md); background: var(--color-success-bg); }
    .payment-dialog-intro > .material-icons { color: var(--color-success); font-size: 28px; }
    .payment-dialog-intro strong { display: block; color: var(--color-text-primary); font-size: 14px; }
    .payment-dialog-intro p { margin: 2px 0 0; color: var(--color-text-secondary); font-size: 12px; }
    @media (max-width: 480px) {
      [modal-actions] { display: flex; flex-direction: column-reverse; width: 100%; }
      [modal-actions] .btn { width: 100%; }
    }
  `],
})
export class PaymentDialogComponent {
  form = this.fb.group({
    amount: [this.data.suggestedAmount || null, [Validators.required, Validators.min(1)]],
    method: ['transferencia', Validators.required],
    notes: ['', Validators.maxLength(500)],
  });

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PaymentDialogData,
  ) {}

  cancel() {
    this.dialogRef.close();
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      amount: Number(value.amount),
      method: value.method!,
      notes: value.notes?.trim() || null,
    } satisfies PaymentPayload);
  }
}
