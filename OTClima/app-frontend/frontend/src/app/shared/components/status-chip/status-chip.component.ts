import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusLabelPipe } from '../../pipes/status-label.pipe';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe],
  template: `
    <span
      class="status-chip status-chip-detail"
      [class.open]="open()"
      [ngClass]="status"
      role="button"
      tabindex="0"
      (click)="toggle($event)"
      (keydown.enter)="toggle($event)"
      (keydown.space)="toggle($event)"
      (blur)="open.set(false)">
      {{ status | statusLabel }}
    </span>

    <span class="status-modal-backdrop" *ngIf="open()" (click)="close($event)">
      <span class="status-detail-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <strong>{{ status | statusLabel }}</strong>
        <span>{{ detailText() }}</span>
        <button type="button" class="status-modal-close" (click)="close($event)" aria-label="Cerrar detalle">
          <span class="material-icons">close</span>
        </button>
      </span>
    </span>
  `,
  styles: [`
    .status-chip-detail {
      position: relative;
      cursor: pointer;
    }

    .status-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgb(15 23 42 / 0.22);
    }

    .status-detail-modal {
      position: relative;
      width: min(320px, calc(100vw - 40px));
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      box-shadow: var(--shadow-lg);
      color: var(--color-text-primary);
      text-align: left;
      white-space: normal;
      line-height: 1.35;
    }

    .status-detail-modal strong,
    .status-detail-modal > span {
      display: block;
    }

    .status-detail-modal strong {
      padding-right: 28px;
      margin-bottom: 4px;
      font-size: 12px;
      font-weight: 700;
    }

    .status-detail-modal > span {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .status-modal-close {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .status-modal-close:hover {
      background: var(--color-surface-alt);
      color: var(--color-text-primary);
    }

    .status-modal-close .material-icons {
      font-size: 18px;
    }
  `],
})
export class StatusChipComponent {
  @Input() status = '';
  @Input() detail = '';
  open = signal(false);

  toggle(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  close(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.open.set(false);
  }

  detailText(): string {
    if (this.detail) return this.detail;
    return STATUS_DETAILS[this.status] ?? 'Movimiento registrado el 18/06/2026 a las 09:30 por Usuario demo.';
  }
}

const STATUS_DETAILS: Record<string, string> = {
  diagnosis: 'Movimiento registrado el 18/06/2026 a las 09:30 por Camila Torres.',
  quotation_sent: 'Movimiento registrado el 18/06/2026 a las 10:15 por Felipe Rojas.',
  approved: 'Movimiento registrado el 18/06/2026 a las 11:40 por Daniela Muñoz.',
  in_execution: 'Movimiento registrado el 18/06/2026 a las 14:05 por Marco Silva.',
  finished: 'Movimiento registrado el 18/06/2026 a las 16:20 por Ana Pérez.',
  paid: 'Movimiento registrado el 18/06/2026 a las 17:10 por Administración OTLabs.',
  rejected: 'Movimiento registrado el 18/06/2026 a las 12:00 por Cliente demo.',
};
