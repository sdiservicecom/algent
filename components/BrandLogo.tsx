import Link from 'next/link';

interface Props {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-3xl',
};

/** Logo texte "SDI Bet" avec accent vert sur "Bet". */
export function BrandLogo({ href = '/dashboard', size = 'md' }: Props) {
  const inner = (
    <span className={`font-display font-bold tracking-tight text-white ${SIZE[size]}`}>
      SDI <span className="text-accentBright">Bet</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="SDI Bet">
      {inner}
    </Link>
  );
}
