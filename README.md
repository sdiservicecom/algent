# Algent — Tournoi virtuel

Application interne de paris à monnaie virtuelle pour un tournoi d'entreprise.
Aucun argent réel n'est impliqué.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript + Tailwind
- **Prisma** + **PostgreSQL**
- **bcryptjs** + **jose** (JWT en cookie httpOnly)
- Déploiement **Vercel** (cron job inclus)

## Mise en route locale

```bash
# 1. Dépendances
npm install

# 2. Variables d'env
cp .env.example .env
# Éditer DATABASE_URL et AUTH_SECRET

# 3. Schéma
npx prisma migrate dev --name init

# 4. Index partiels (1 pari PENDING / match, username case-insensitive)
psql "$DATABASE_URL" -c "
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_bet_per_match
  ON \"Bet\" (\"userId\", \"matchId\") WHERE status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS user_username_lower_unique
  ON \"User\" (LOWER(\"username\"));
"

# 5. Admin par défaut
npm run db:seed   # admin / admin1234 (configurable via ADMIN_USERNAME / ADMIN_PASSWORD)

# 6. Dev
npm run dev
```

## Déploiement Vercel

1. **Créer une base PostgreSQL** (Vercel Postgres, Neon ou Supabase). Récupérer l'URL.
2. Sur Vercel → Settings → Environment Variables :
   - `DATABASE_URL` (avec `?pgbouncer=true&connection_limit=1` si pooler)
   - `AUTH_SECRET` (>= 32 octets : `openssl rand -base64 32`)
   - `CRON_SECRET` (Vercel le passe automatiquement aux endpoints `/api/cron/*` via `Authorization: Bearer <CRON_SECRET>`)
3. Déployer. Le `build` lance `prisma generate && prisma migrate deploy && next build`.
4. Après le 1er déploiement, exécuter manuellement les `CREATE UNIQUE INDEX` partiels (voir ci-dessus) sur la base.
5. Lancer le seed admin une fois (`npm run db:seed` localement contre la DB de prod, ou via une migration dédiée).

Le cron quotidien (`vercel.json`) frappe `/api/cron/daily-bonus` à 06:00 UTC.

## Arborescence

```
.
├── app/
│   ├── (app)/                # Routes authentifiées : dashboard, matches, history, leaderboard
│   ├── admin/                # Routes admin (RolesGuard via requireAdmin)
│   ├── login/  register/     # Auth
│   └── api/
│       ├── auth/me           # Session courante
│       ├── wallet/balance    # Solde
│       ├── leaderboard       # Classement
│       └── cron/daily-bonus  # Cron Vercel
├── components/               # BetForm, AutoRefresh
├── lib/
│   ├── prisma.ts             # Singleton Prisma
│   ├── auth.ts               # JWT + cookie + helpers session
│   ├── odds.ts               # Cotes initiales (sigmoïde) + dynamiques (lissage + market)
│   ├── wallet.ts             # Verrou + delta + log transaction
│   ├── bets.ts               # Placement de pari (TX SERIALIZABLE)
│   ├── matches.ts            # Création / transitions / settle / cancel
│   ├── daily-bonus.ts        # Logique du bonus quotidien
│   ├── leaderboard.ts        # Agrégation classement
│   └── format.ts             # Formatage points/cotes/dates
├── middleware.ts             # Garde JWT + redirections
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docs/SPECIFICATION.md     # Spec produit complète
├── vercel.json               # Cron daily-bonus
└── package.json
```

## Choix techniques clés

| Sujet | Décision |
|---|---|
| Monnaie | `Int` (jamais de float) |
| Cotes | `Decimal(6,3)`, sigmoïde initiale, lissage exponentiel |
| Concurrence | Prisma `Serializable` + `SELECT ... FOR UPDATE` |
| Auth | JWT signé HS256 dans cookie httpOnly |
| Realtime | `router.refresh()` + `setInterval(10s)` côté client (pas de WebSocket/SSE) |
| Cron | Vercel Cron (1×/jour) |
| Anti double-pari | Index partiel unique sur `(userId, matchId) WHERE status='PENDING'` |
| Lock paris | 2 minutes avant `startsAt`, vérifié à la pose |

Voir [docs/SPECIFICATION.md](docs/SPECIFICATION.md) pour la spec complète et l'algorithme des cotes détaillé avec exemples chiffrés.
