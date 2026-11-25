import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Package,
  Printer,
  Truck,
  XCircle,
} from 'lucide-react';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_MAP: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

function inferTone(status: string): Tone {
  const s = status.toUpperCase();
  if (
    s.includes('APPROVED') ||
    s.includes('AUTHORIZED') ||
    s.includes('VERIFIED') ||
    s.includes('DELIVERED') ||
    s.includes('SEALED') ||
    s.includes('RESOLVED') ||
    s.includes('COMMITTED') ||
    s.includes('COMPLETED') ||
    s === 'ACTIVE'
  ) {
    if (s.includes('UNVERIFIED') || s.includes('PARTIAL')) return 'warning';
    return 'success';
  }
  if (
    s.includes('REJECTED') ||
    s.includes('LOCKED') ||
    s.includes('DAMAGED') ||
    s.includes('FAILED') ||
    s.includes('ERROR') ||
    s.includes('INVESTIGATION') ||
    s.includes('RETURNED')
  ) {
    return 'danger';
  }
  if (
    s.includes('PENDING') ||
    s.includes('WARNING') ||
    s.includes('UNVERIFIED') ||
    s.includes('PARTIAL') ||
    s.includes('REVIEW') ||
    s.includes('OPEN') ||
    s.includes('REPRINT')
  ) {
    return 'warning';
  }
  if (
    s.includes('TRANSIT') ||
    s.includes('DISPATCH') ||
    s.includes('PROGRESS') ||
    s.includes('PRINTING') ||
    s.includes('PACKED') ||
    s.includes('QUEUED')
  ) {
    return 'info';
  }
  return 'neutral';
}

function getIcon(status: string) {
  const s = status.toUpperCase();
  if (s.includes('LOCKED')) return <Lock className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('REJECTED') || s.includes('FAILED')) return <XCircle className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('DAMAGED') || s.includes('ERROR') || s.includes('INVESTIGATION')) return <AlertCircle className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('WARNING') || s.includes('UNVERIFIED') || s.includes('RETURNED')) return <AlertTriangle className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('DELIVERED') || s.includes('APPROVED') || s.includes('VERIFIED') || s.includes('RESOLVED') || s.includes('AUTHORIZED'))
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('PRINT')) return <Printer className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('PACK') || s.includes('SEAL') || s.includes('BUNDLE')) return <Package className="h-3.5 w-3.5 shrink-0" />;
  if (s.includes('DISPATCH') || s.includes('TRANSIT') || s.includes('DELIVERY')) return <Truck className="h-3.5 w-3.5 shrink-0" />;
  return <Clock className="h-3.5 w-3.5 shrink-0" />;
}

export const StatusBadge: React.FC<{ status: string; tone?: Tone; label?: string }> = ({
  status,
  tone,
  label,
}) => {
  const resolvedTone = tone || inferTone(status);
  const display = (label || status).replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_MAP[resolvedTone]}`}
    >
      {getIcon(status)}
      <span>{display}</span>
    </span>
  );
};
