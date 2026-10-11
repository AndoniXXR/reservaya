import type { AppointmentStatus } from '@/api/appointments';
import { Badge } from '@/components/ui/Badge';
import { STATUS_LABELS, STATUS_TONES } from './status';

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
