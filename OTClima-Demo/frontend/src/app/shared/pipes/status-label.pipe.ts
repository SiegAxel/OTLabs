import { Pipe, PipeTransform } from '@angular/core';
import { OT_STATUS_LABELS, OtStatus } from '../../core/models';

@Pipe({ name: 'statusLabel', standalone: true })
export class StatusLabelPipe implements PipeTransform {
  transform(status: string): string {
    return OT_STATUS_LABELS[status as OtStatus] ?? status;
  }
}
