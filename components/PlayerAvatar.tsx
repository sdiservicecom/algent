import type { Player } from '@/lib/types';

interface Props {
  player: Pick<Player, 'firstName' | 'lastName' | 'photoUrl'>;
  size?: number;
  className?: string;
}

const SIZE_CLASS: Record<number, string> = {
  24: 'h-6 w-6 text-[10px]',
  32: 'h-8 w-8 text-xs',
  40: 'h-10 w-10 text-sm',
  56: 'h-14 w-14 text-base',
  72: 'h-[72px] w-[72px] text-lg',
};

export function PlayerAvatar({ player, size = 40, className = '' }: Props) {
  const initials =
    `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`.toUpperCase();
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS[40];

  if (player.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.photoUrl}
        alt={`${player.firstName} ${player.lastName}`}
        className={`${sizeClass} shrink-0 rounded-full border border-border object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-fg/5 font-semibold text-fg/70 ${className}`}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
