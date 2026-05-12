import { CoinIcon } from './CoinIcon';
import { fmtPoints } from '@/lib/format';

interface Props {
  amount: number;
  /** "lg" pour le hero du profil, "md" header, "sm" inline. */
  size?: 'sm' | 'md' | 'lg';
  /** Quand true, force le texte en couleur danger (perte). */
  tone?: 'default' | 'success' | 'danger';
  /** Indique si on doit afficher le signe + devant les montants positifs. */
  withSign?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'gap-1 px-2 py-0.5 text-xs',
  md: 'gap-1.5 px-3 py-1 text-sm',
  lg: 'gap-2 px-4 py-2 text-lg',
};

const COIN_SIZE: Record<NonNullable<Props['size']>, number> = {
  sm: 10,
  md: 12,
  lg: 16,
};

const TONE_CLASS: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-white/8 text-fg',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
};

export function PointsBadge({
  amount,
  size = 'md',
  tone = 'default',
  withSign = false,
  className = '',
}: Props) {
  const sign = withSign && amount > 0 ? '+' : '';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`}
    >
      {sign}
      {fmtPoints(amount)}
      <CoinIcon size={COIN_SIZE[size]} />
    </span>
  );
}
