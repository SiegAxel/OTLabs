import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  template: `
    <div class="modal-shell">
      <div class="modal-header">
        <h2 mat-dialog-title>{{ title }}</h2>
        <button mat-icon-button type="button" class="close-btn" aria-label="Cerrar" (click)="close()">
          <span class="material-icons">close</span>
        </button>
      </div>

      <mat-dialog-content class="modal-content">
        <ng-content select="[modal-body]"></ng-content>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="modal-actions">
        <ng-content select="[modal-actions]"></ng-content>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .modal-shell {
      width: 100%;
      max-width: 100%;
      background: var(--color-surface);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px 8px;
      border-bottom: 1px solid var(--color-border);
    }

    h2[mat-dialog-title] {
      margin: 0;
      padding: 0;
      color: var(--color-text-primary);
      font-size: 20px;
      line-height: 1.2;
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--color-text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .close-btn:hover {
      background: var(--color-surface-alt);
      color: var(--color-text-primary);
    }

    .close-btn .material-icons {
      font-size: 20px;
    }

    .modal-content {
      padding: 20px;
      margin: 0;
    }

    .modal-actions {
      padding: 12px 20px 20px;
      margin: 0;
      gap: 10px;
      border-top: 1px solid var(--color-border);
    }

    @media (max-width: 600px) {
      .modal-header {
        padding: 16px 16px 8px;
      }

      .modal-content {
        padding: 16px;
      }

      .modal-actions {
        padding: 12px 16px 16px;
      }
    }
  `],
})
export class ModalShellComponent {
  @Input({ required: true }) title = '';

  constructor(private dialogRef: MatDialogRef<unknown>) {}

  close() {
    this.dialogRef.close();
  }
}
