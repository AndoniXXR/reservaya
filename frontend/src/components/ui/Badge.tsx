import type { ReactNode } from 'react';

type Tone = 'green' | 'gray' | 'red' | 'blue' | 'amber';

const tones: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  gray: 'bg-slate-100 text-slate-700',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800',
  amber: 'bg-amber-100 text-amber-800',
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
