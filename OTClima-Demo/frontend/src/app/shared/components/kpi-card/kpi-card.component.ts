import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-card">
      <div class="kpi-icon" [style.background]="iconBg">
        <span class="material-icons" [style.color]="iconColor">{{ icon }}</span>
      </div>
      <div class="kpi-content">
        <div class="kpi-label">{{ label }}</div>
        <div class="kpi-value">{{ value }}</div>
        <div class="kpi-sub" *ngIf="sub">{{ sub }}</div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-card {
      display: flex; align-items: center; gap: 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 20px;
      box-shadow: var(--shadow-sm);
    }
    .kpi-icon {
      width: 52px; height: 52px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kpi-icon .material-icons { font-size: 26px; }
    .kpi-label { font-size: 13px; color: var(--color-text-secondary); font-weight: 500; }
    .kpi-value { font-size: 26px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
    .kpi-sub   { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
  `],
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() sub = '';
  @Input() icon = 'analytics';
  @Input() iconColor = 'var(--color-primary-600)';
  @Input() iconBg = 'var(--color-primary-100)';
}
