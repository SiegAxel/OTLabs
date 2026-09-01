import { WorkOrderStatusMovement } from '../models';
import {
  formatMovementDate,
  movementTitle,
  normalizeStatusHistory,
} from './work-order-history';

describe('work order history utilities', () => {
  const changedBy = { id: 4, name: 'Camila Torres', email: 'camila@empresa.cl' };

  it('normalizes a missing history as an empty list', () => {
    expect(normalizeStatusHistory(undefined)).toEqual([]);
    expect(normalizeStatusHistory(null)).toEqual([]);
  });

  it('sorts movements chronologically and removes duplicate ids', () => {
    const history: WorkOrderStatusMovement[] = [
      { id: 2, from_status: 'diagnosis', to_status: 'quotation_sent', created_at: '2026-07-26T16:00:00Z', changed_by: changedBy },
      { id: 1, from_status: null, to_status: 'diagnosis', created_at: '2026-07-26T14:00:00Z', changed_by: changedBy },
      { id: 2, from_status: 'diagnosis', to_status: 'quotation_sent', created_at: '2026-07-26T16:00:00Z', changed_by: changedBy },
    ];

    expect(normalizeStatusHistory(history).map((movement) => movement.id)).toEqual([1, 2]);
  });

  it('labels creation and rejection movements in Spanish', () => {
    expect(movementTitle({
      id: 1, from_status: null, to_status: 'diagnosis',
      created_at: '2026-07-26T14:00:00Z', changed_by: changedBy,
    })).toBe('Orden creada en Diagnóstico');

    expect(movementTitle({
      id: 2, from_status: 'quotation_sent', to_status: 'rejected',
      created_at: '2026-07-26T15:00:00Z', changed_by: changedBy,
    })).toBe('Cotización enviada → Rechazada');
  });

  it('formats valid dates for the Chilean locale', () => {
    const formatted = formatMovementDate('2026-07-26T14:30:00Z');
    expect(formatted).not.toBe('Fecha no disponible');
    expect(formatted).toContain('26');
  });
});
