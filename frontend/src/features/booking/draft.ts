import type { Service } from '@/api/services';
import type { Slot } from '@/api/availability';

export interface BookingDraft {
  step: 1 | 2 | 3 | 4;
  service: Service | null;
  /** null = "Cualquiera disponible" */
  staffId: string | null;
  staffName: string | null;
  date: string | null;
  slot: Slot | null;
  notes: string;
}

export const EMPTY_DRAFT: BookingDraft = {
  step: 1,
  service: null,
  staffId: null,
  staffName: null,
  date: null,
  slot: null,
  notes: '',
};

const STORAGE_KEY = 'reservaya:booking-draft';

// sessionStorage conserva la selección si el usuario tiene que iniciar sesión en el paso 4.
// Puede fallar (modo privado, almacenamiento bloqueado): en ese caso simplemente no se guarda.
export function loadDraft(): BookingDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<BookingDraft>;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: BookingDraft): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // sin almacenamiento disponible
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sin almacenamiento disponible
  }
}
