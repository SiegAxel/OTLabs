import {
  OT_STATUS_LABELS,
  OtStatus,
  WorkOrderStatusMovement,
} from '../models';

export function normalizeStatusHistory(
  history: WorkOrderStatusMovement[] | null | undefined,
): WorkOrderStatusMovement[] {
  if (!Array.isArray(history)) return [];

  const unique = new Map<number, WorkOrderStatusMovement>();
  history.forEach((movement) => {
    if (movement && !unique.has(movement.id)) unique.set(movement.id, movement);
  });

  return [...unique.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function movementTitle(movement: WorkOrderStatusMovement): string {
  if (movement.from_status === null) {
    return `Orden creada en ${OT_STATUS_LABELS[movement.to_status]}`;
  }
  return `${OT_STATUS_LABELS[movement.from_status]} → ${OT_STATUS_LABELS[movement.to_status]}`;
}

export function formatMovementDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(date);
}

export function movementForStatus(
  history: WorkOrderStatusMovement[],
  status: OtStatus,
): WorkOrderStatusMovement | undefined {
  return [...history].reverse().find((movement) => movement.to_status === status);
}
