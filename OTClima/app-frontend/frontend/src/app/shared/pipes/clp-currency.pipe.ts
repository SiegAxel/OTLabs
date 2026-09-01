import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'clp', standalone: true })
export class ClpCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '$0';
    return '$' + Math.round(value).toLocaleString('es-CL');
  }
}
