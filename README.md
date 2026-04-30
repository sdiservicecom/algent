# Algent — Tournoi virtuel

Application interne de paris à monnaie virtuelle pour un tournoi d'entreprise.
Aucun argent réel.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript + Tailwind
- **Upstash Redis** (via l'intégration Vercel Marketplace) pour tout le stockage — pas de schéma, pas de migrations
- **Vercel Blob** (optionnel) pour héberger les photos des joueurs uploadées depuis l'admin
- **bcryptjs** + **jose** (JWT en cookie httpOnly)
- Déploiement **Vercel** (cron job inclus)

## Déploiement Vercel

1. Sur Vercel, **Storage → Browse Marketplace → Upstash Redis**, créer la base et **Connect** au projet `algent` : les variables `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` sont auto-injectées.
2. Settings → Environment Variables, ajouter :
   - `AUTH_SECRET` (>= 32 caractères : `openssl rand -base64 32`)
   - `CRON_SECRET` (n'importe quel secret long, Vercel l'envoie auto aux endpoints `/api/cron/*`)
3. *(optionnel)* Pour permettre l'upload de photos joueurs : Storage → Browse Marketplace → **Blob** → créer et **Connect** au projet (`BLOB_READ_WRITE_TOKEN` auto-injecté). Sans cette intégration, l'admin peut toujours coller une URL d'image externe.
4. Redeploy.
5. **Le premier utilisateur qui s'inscrit devient ADMIN automatiquement** — va sur `/register`, crée ton compte d'admin, puis tu pourras créer joueurs / matchs depuis `/admin`.

Le cron quotidien (`vercel.json`) frappe `/api/cron/daily-bonus` à 06:00 UTC.

## Mise en route locale

```bash
# 1. Dépendances
npm install

# 2. Lier le projet Vercel et récupérer les variables KV
npx vercel link
npx vercel env pull .env.local

# 3. Ajouter AUTH_SECRET et CRON_SECRET à .env.local si absents

# 4. Dev
npm run dev
```

## Arborescence

```
.
├── app/
│   ├── (app)/                # Routes authentifiées : dashboard, matches, history, leaderboard
│   ├── admin/                # Routes admin (requireAdmin)
│   ├── login/  register/     # Auth
│   └── api/
│       ├── auth/me           # Session courante
│       ├── wallet/balance    # Solde
│       └── cron/daily-bonus  # Cron Vercel
├── components/               # BetForm, AutoRefresh
├── lib/
│   ├── kv.ts                 # Client Vercel KV + conventions de clés
│   ├── types.ts              # Types métier (User, Match, Bet, …)
│   ├── auth.ts               # JWT + cookie + helpers session
│   ├── odds.ts               # Cotes initiales (sigmoïde) + dynamiques (lissage + market)
│   ├── wallet.ts             # Delta de solde + log de transaction
│   ├── users.ts              # CRUD users
│   ├── players.ts            # CRUD players
│   ├── matches.ts            # CRUD matches + transitions + settle / cancel
│   ├── bets.ts               # placeBet (avec garde anti double-pari atomique)
│   ├── daily-bonus.ts        # Logique du bonus quotidien
│   ├── leaderboard.ts        # Agrégation classement
│   └── format.ts             # Formatage points / cotes / dates
├── middleware.ts             # Garde JWT + redirections
├── docs/SPECIFICATION.md     # Spec produit complète
├── vercel.json               # Cron daily-bonus
└── package.json
```

## Modèle de stockage (Vercel KV)

| Clé | Type Redis | Contenu |
|---|---|---|
| `algent:user:{id}` | HASH | User (champ `balance` mis à jour atomiquement par `HINCRBY`) |
| `algent:username:{lower}` | string | userId (réservation atomique via `SET NX`) |
| `algent:users:all` | SET | tous les userIds |
| `algent:player:{id}` | JSON | Player |
| `algent:player:bySeed:{n}` | string | playerId (anti-doublon de seed) |
| `algent:players:byseed` | ZSET | playerId trié par seed |
| `algent:match:{id}` | HASH | Match (totaux + cotes mis à jour par champ) |
| `algent:matches:bytime` | ZSET | matchId trié par `startsAt` |
| `algent:bet:{id}` | JSON | Bet |
| `algent:bets:byuser:{userId}` | ZSET | betId trié par `placedAt` |
| `algent:bets:bymatch:{matchId}` | ZSET | betId trié par `placedAt` |
| `algent:bets:pending:bymatch:{matchId}` | SET | betIds PENDING (pour settlement) |
| `algent:bets:pending:{userId}:{matchId}` | string | betId — `SET NX` garantit 1 pari actif par match |
| `algent:tx:{id}` | JSON | PointTransaction |
| `algent:txs:byuser:{userId}` | ZSET | txId trié par `createdAt` |
| `algent:bonus:{userId}:{YYYY-MM-DD}` | string | montant (idempotence du bonus quotidien) |
| `algent:odds:bymatch:{matchId}` | LIST | snapshots de cotes |

## Choix techniques

| Sujet | Décision |
|---|---|
| Stockage | Vercel KV (Upstash Redis), pas de SGBD |
| Monnaie | entiers, jamais de float — `HINCRBY` atomique |
| Cotes | sigmoïde initiale, lissage exponentiel + mix marché borné à 60% |
| Auth | JWT signé HS256 dans cookie httpOnly |
| Realtime | `router.refresh()` toutes les 10 s côté client |
| Cron | Vercel Cron (1×/jour) |
| Anti double-pari | `SET NX` sur `algent:bets:pending:{userId}:{matchId}` |
| Anti solde négatif | `HINCRBY` puis rollback si résultat < 0 |
| Lock paris | 2 minutes avant `startsAt`, vérifié à la pose |
| Premier admin | Le 1er utilisateur inscrit → rôle ADMIN |

Voir [docs/SPECIFICATION.md](docs/SPECIFICATION.md) pour la spec complète et l'algorithme des cotes détaillé avec exemples chiffrés.
