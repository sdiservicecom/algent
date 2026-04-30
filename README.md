# Algent — Application de paris virtuels (tournoi interne)

Application web interne pour un tournoi d'entreprise basée sur un système de paris à monnaie virtuelle.

- Aucun argent réel.
- Cotes initiales calculées depuis le seeding des joueurs.
- Cotes dynamiques ajustées selon les mises (lissées et bornées).
- Bonus quotidien automatique pour éviter les utilisateurs bloqués à zéro.
- Rôles `USER` et `ADMIN`.

## Stack

- Frontend : React 18 + Vite + TypeScript + TanStack Query + Zustand
- Backend : NestJS + Prisma
- Base : PostgreSQL
- Temps réel : SSE
- Auth : JWT (httpOnly cookie) + bcrypt

## Documentation

La spécification complète (architecture, modèle de données, API, algorithme des cotes,
flux de pari, frontend, bonus) se trouve dans **[docs/SPECIFICATION.md](docs/SPECIFICATION.md)**.

## Arborescence

```
.
├── backend/
│   ├── prisma/
│   │   └── schema.prisma           # Modèle de données
│   └── src/
│       ├── odds/                   # Calcul des cotes (initial + dynamique)
│       ├── wallet/                 # Service transactionnel solde
│       ├── bets/                   # Placement des paris
│       ├── matches/                # Règlement / annulation match
│       ├── daily-bonus/            # Cron bonus quotidien
│       └── realtime/               # SSE
└── docs/
    └── SPECIFICATION.md
```
