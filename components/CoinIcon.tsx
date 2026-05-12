interface Props {
  size?: number;
  className?: string;
}

/**
 * Jeton jaune SDI Bet — pastille pleine avec un petit reflet blanc.
 * Utilise `currentColor` n'est pas pertinent ici, la couleur est volontairement fixe.
 */
export function CoinIcon({ size = 14, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <circle cx="8" cy="8" r="7" fill="#facc15" />
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="#a16207" strokeOpacity="0.4" strokeWidth="0.6" />
      <circle cx="6" cy="5.6" r="1.6" fill="#fde68a" />
    </svg>
  );
}
