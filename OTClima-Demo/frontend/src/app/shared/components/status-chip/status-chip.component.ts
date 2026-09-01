import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusLabelPipe } from '../../pipes/status-label.pipe';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe],
  template: `<span class="status-chip" [ngClass]="status">{{ status | statusLabel }}</span>`,
})
export class StatusChipComponent {
  @Input() status = '';
}
