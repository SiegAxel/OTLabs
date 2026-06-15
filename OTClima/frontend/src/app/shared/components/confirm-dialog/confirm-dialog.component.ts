import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog" [class.danger]="data.danger">
      <div class="confirm-header">
        <div class="confirm-icon">
          <mat-icon>{{ data.danger ? 'warning' : 'help_outline' }}</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title *ngIf="data.title">{{ data.title }}</h2>
          <mat-dialog-content [class.question-only]="!data.title">{{ data.message }}</mat-dialog-content>
        </div>
      </div>

      <mat-dialog-actions align="end">
        <button type="button" class="btn btn-ghost" (click)="ref.close(false)">Cancelar</button>
        <button type="button" class="btn" [class.btn-danger]="data.danger" [class.btn-primary]="!data.danger" (click)="ref.close(true)">
          {{ data.confirmText ?? 'Confirmar' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      width: min(420px, calc(100vw - 32px));
      background: var(--color-surface);
    }

    .confirm-header {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 14px;
      padding: 22px 22px 10px;
    }

    .confirm-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary-600);
      background: var(--color-primary-50);
      flex-shrink: 0;
    }

    .danger .confirm-icon {
      color: var(--color-error);
      background: var(--color-error-bg);
    }

    h2[mat-dialog-title] {
      margin: 0 0 8px;
      padding: 0;
      font-size: 18px;
      line-height: 1.25;
    }

    mat-dialog-content {
      display: block;
      margin: 0;
      padding: 0;
      font-size: 14px;
      line-height: 1.45;
      color: var(--color-text-secondary);
    }

    mat-dialog-content.question-only {
      color: var(--color-text-primary);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.35;
    }

    mat-dialog-actions {
      margin: 0;
      padding: 14px 22px 22px;
      gap: 10px;
    }

    @media (max-width: 480px) {
      .confirm-header {
        grid-template-columns: 1fr;
      }

      mat-dialog-actions {
        align-items: stretch;
        flex-direction: column-reverse;
      }

      mat-dialog-actions .btn {
        width: 100%;
      }
    }
  `],
})
export class ConfirmDialogComponent {
  constructor(
    public ref: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}
}
