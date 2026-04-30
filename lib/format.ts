export const fmtPoints = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n);

export const fmtOdds = (o: number | string) => Number(o).toFixed(2);

export const fmtPct = (p: number) =>
  `${(p * 100).toFixed(0)}%`;

export const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(typeof d === 'string' ? new Date(d) : d);
