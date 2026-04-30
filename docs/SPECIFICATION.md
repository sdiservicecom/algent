# Spécification technique — App de paris virtuels interne

## A. Architecture globale

### A.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                       │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐ │
│  │ Dashboard │  │  Matches   │  │ Bet flow   │  │ Admin   │ │
│  └───────────┘  └────────────┘  └────────────┘  └─────────┘ │
│        │  React Query (HTTP) + EventSource (SSE)             │
└────────┼─────────────────────────────────────────────────────┘
         │ JSON / REST  + SSE
┌────────▼─────────────────────────────────────────────────────┐
│                    BACKEND (NestJS)                           │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   Auth   │ │  Users   │ │ Matches  │ │     Bets         │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Players  │ │  Odds    │ │ Wallet   │ │   Leaderboard    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────────────────────────────────────┐   │
│  │ Realtime │ │ Scheduler (daily bonus, match locking)   │   │
│  └──────────┘ └──────────────────────────────────────────┘   │
│              Prisma Client (transactions)                     │
└────────────────────────────┬─────────────────────────────────┘
                             │
                ┌────────────▼─────────────┐
                │      PostgreSQL          │
                └──────────────────────────┘
```

### A.2 Choix techniques

| Couche | Choix | Justification |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | DX rapide, build léger, suffisant pour app interne |
| State serveur | TanStack Query | Cache + invalidation, idéal pour polling/SSE |
| State client | Zustand | Plus simple que Redux pour un petit périmètre |
| Backend | NestJS | Modulaire, DI, validation native, guards/roles intégrés |
| ORM | Prisma | Migrations claires, types générés, transactions interactives propres |
| Auth | JWT (24 h) en httpOnly cookie | Pas de SSO, pas de refresh token nécessaire |
| Hash | bcrypt (cost 10) | Standard, suffisant |
| Temps réel | SSE | Plus simple que WebSocket, push unidirectionnel suffit |
| Jobs | `@nestjs/schedule` | Cron natif, pas besoin de Redis/BullMQ |
| Tests | Jest + Supertest | Standard NestJS |

---

## B. Modèle de données PostgreSQL

Voir [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

### Points clés

- **Solde en `Int`** : pas de drift d'arrondi.
- **Cotes en `Decimal(6,3)`** : 3 décimales suffisent.
- **`balanceAfter`** dans chaque transaction → audit trivial.
- **Partial unique index** pour empêcher 2 paris `PENDING` sur le même match :
  ```sql
  CREATE UNIQUE INDEX one_pending_bet_per_match
  ON "Bet" ("userId", "matchId") WHERE status = 'PENDING';
  ```
- **`@@unique([userId, bonusDate])`** garantit l'unicité du bonus quotidien.
- **`OddsSnapshot`** historise toutes les variations de cotes.

---

## C. Entités backend & relations

```
User 1 ─── n Bet ─── 1 Match ─── 1 Player (A)
 │                       │   ─── 1 Player (B)
 │                       │   ─── 0/1 Player (winner)
 ├─── n PointTransaction
 └─── n DailyBonus

Match 1 ─── n OddsSnapshot
```

### Modules NestJS

```
src/
├── auth/                # AuthController, AuthService, JwtStrategy, Roles guard
├── users/               # profil, balance
├── players/             # CRUD admin
├── matches/             # CRUD admin + listing public
├── bets/                # placement, listing, annulation admin
├── odds/                # service de calcul (initial + dynamique)
├── wallet/              # service transactionnel: débit/crédit + tx log
├── leaderboard/         # vue agrégée
├── daily-bonus/         # service + cron
├── realtime/            # SSE controller (broadcast)
├── common/              # decorators, guards, pipes, filters
└── prisma/              # PrismaService
```

---

## D. API REST

Toutes les routes sous `/api/v1`. Auth via `Authorization: Bearer <jwt>` ou cookie.

### D.1 Authentification

| Méthode | URL | Rôle | Body | Réponse | Erreurs |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{firstName, lastName, username, password}` | `{user, token}` | 409 username pris, 400 validation |
| POST | `/auth/login` | Public | `{username, password}` | `{user, token}` | 401 invalid creds |
| GET | `/auth/me` | USER | — | `User` | 401 |

### D.2 Matchs (lecture)

| Méthode | URL | Rôle | Réponse |
|---|---|---|---|
| GET | `/matches` | USER | `Match[]` (filtres `?status=`) |
| GET | `/matches/:id` | USER | `Match` (joueurs, cotes, totaux) |
| GET | `/matches/:id/odds-history` | USER | `OddsSnapshot[]` |

### D.3 Paris

| Méthode | URL | Rôle | Body | Réponse | Erreurs |
|---|---|---|---|---|---|
| POST | `/bets` | USER | `{matchId, pickedPlayerId, stake}` | `Bet` | 400 stake invalide, 402 solde insuffisant, 409 match verrouillé / pari déjà existant, 404 match |
| GET | `/bets/me` | USER | — | `Bet[]` |
| GET | `/bets/me/active` | USER | — | `Bet[]` (PENDING) |

### D.4 Wallet

| Méthode | URL | Rôle | Réponse |
|---|---|---|---|
| GET | `/wallet/balance` | USER | `{balance}` |
| GET | `/wallet/transactions` | USER | `PointTransaction[]` (paginé) |
| GET | `/wallet/daily-bonus/today` | USER | `{received: bool, amount?: number}` |

### D.5 Leaderboard

| Méthode | URL | Rôle | Réponse |
|---|---|---|---|
| GET | `/leaderboard` | USER | `LeaderboardEntry[]` |
| GET | `/realtime/stream` | USER | SSE events |

### D.6 Admin — Joueurs

| Méthode | URL | Rôle | Body |
|---|---|---|---|
| POST | `/admin/players` | ADMIN | `{firstName, lastName, seed}` |
| PATCH | `/admin/players/:id` | ADMIN | `Partial<Player>` |
| DELETE | `/admin/players/:id` | ADMIN | — |

### D.7 Admin — Matchs

| Méthode | URL | Rôle | Action |
|---|---|---|---|
| POST | `/admin/matches` | ADMIN | crée match, calcule cotes initiales |
| PATCH | `/admin/matches/:id` | ADMIN | update partiel |
| POST | `/admin/matches/:id/open` | ADMIN | → `OPEN_FOR_BETS` |
| POST | `/admin/matches/:id/lock` | ADMIN | → `LOCKED` |
| POST | `/admin/matches/:id/settle` | ADMIN | calcule gains, transactions, statuts |
| POST | `/admin/matches/:id/cancel` | ADMIN | annule + rembourse |
| GET | `/admin/matches/:id/bets` | ADMIN | `Bet[]` |

### D.8 Admin — Transactions & ajustements

| Méthode | URL | Rôle | Body |
|---|---|---|---|
| GET | `/admin/transactions` | ADMIN | filtres user/type/date |
| POST | `/admin/users/:id/adjust` | ADMIN | `{amount, reason}` |
| POST | `/admin/bets/:id/cancel` | ADMIN | rembourse + statut CANCELLED |

### D.9 Codes erreur standardisés

```json
{ "error": "INSUFFICIENT_BALANCE", "message": "Solde insuffisant", "details": {} }
```

Codes : `INSUFFICIENT_BALANCE`, `MATCH_NOT_OPEN`, `BET_ALREADY_PLACED`, `MATCH_STARTED`, `INVALID_PLAYER`, `STAKE_OUT_OF_BOUNDS`, `FORBIDDEN`.

---

## E. Algorithme des cotes dynamiques

### E.1 Cotes initiales depuis le seeding

```
diff       = seedB - seedA
pA_initial = 1 / (1 + exp(-diff * SENSITIVITY))
pB_initial = 1 - pA_initial
oddsA      = 1 / pA_initial
oddsB      = 1 / pB_initial
```

`SENSITIVITY` (défaut **0.15**).

**Exemple** : seed 2 vs seed 7
- `diff = 5`, `pA = 1/(1+exp(-0.75)) ≈ 0.679`
- `oddsA ≈ 1.472`, `oddsB ≈ 3.115`

### E.2 Ajustement dynamique

Mélange entre cote théorique (seeding) et distribution des mises, lissé.

#### Paramètres

| Paramètre | Défaut | Rôle |
|---|---|---|
| `SENSITIVITY` | 0.15 | Spread des cotes initiales |
| `MARKET_WEIGHT_MAX` | 0.6 | Poids max donné aux mises |
| `MARKET_VOLUME_REF` | 5000 | Volume à partir duquel le marché atteint son poids max |
| `SMOOTHING_LAMBDA` | 0.25 | Facteur de lissage |
| `ODDS_MIN` | 1.05 | Cote plancher |
| `ODDS_MAX` | 15.0 | Cote plafond |
| `MIN_STAKE` | 10 | Mise minimale |
| `MAX_STAKE_ABS` | 50000 | Mise max absolue |

#### Algorithme

```
recalculateOdds(match):
  V        = totalStakeA + totalStakeB
  marketW  = MARKET_WEIGHT_MAX * min(1, V / MARKET_VOLUME_REF)

  pA_seed   = 1 / (1 + exp(-(seedB - seedA) * SENSITIVITY))
  pA_market = V > 0 ? totalStakeA / V : pA_seed
  pA_target = (1 - marketW) * pA_seed + marketW * pA_market

  pA_current = 1 / match.oddsA
  pA_new     = pA_current + SMOOTHING_LAMBDA * (pA_target - pA_current)

  oddsA_new  = clamp(1 / pA_new,       ODDS_MIN, ODDS_MAX)
  oddsB_new  = clamp(1 / (1 - pA_new), ODDS_MIN, ODDS_MAX)

  enregistre OddsSnapshot
  match.oddsA, match.oddsB ← oddsA_new, oddsB_new
```

> Note : plus on mise sur A, plus pA monte donc oddsA baisse → on alimente `pA_market` avec `totalStakeA / V`.

#### Exemple chiffré

Match seed 2 vs seed 7, paramètres défaut.

**Étape 0** : pA_seed ≈ 0.679 → oddsA = 1.472, oddsB = 3.115

**Étape 1** — Alice mise 1000 sur A à 1.472
- V = 1000, pA_market = 1.0, marketW = 0.12
- pA_target = 0.88 × 0.679 + 0.12 × 1.0 = 0.717
- pA_new = 0.679 + 0.25 × (0.717 - 0.679) = 0.689
- **oddsA = 1.452**, **oddsB = 3.215**

**Étape 2** — Bob mise 500 sur B à 3.215
- V = 1500, pA_market = 0.667, marketW = 0.18
- pA_target = 0.82 × 0.679 + 0.18 × 0.667 = 0.677
- pA_new = 0.689 + 0.25 × (0.677 - 0.689) = 0.686
- **oddsA = 1.458**, **oddsB = 3.185**

**Étape 3** — Carla mise 4000 sur A
- V = 5500, pA_market = 0.909, marketW = 0.6
- pA_target = 0.4 × 0.679 + 0.6 × 0.909 = 0.817
- pA_new = 0.686 + 0.25 × (0.817 - 0.686) = 0.719
- **oddsA = 1.391**, **oddsB = 3.559**

### E.3 Risques d'abus & protections

| Risque | Protection |
|---|---|
| Coalition | `MARKET_WEIGHT_MAX = 0.6` + cotes bornées |
| Sniper de dernière seconde | Lock automatique 2 min avant `startsAt` |
| Wash betting (mises sur les deux joueurs) | Partial unique index sur `(userId, matchId)` PENDING |
| Mises atomiques abusives | `MIN_STAKE = 10` + rate-limit (10 paris/min/user) |
| Compte zombi capturant le bonus | Bonus uniquement si match `OPEN_FOR_BETS` ou `SCHEDULED` ce jour |
| Race condition sur le solde | Transaction `SERIALIZABLE` + `SELECT FOR UPDATE` |

---

## F. Logique de pari — code TypeScript

Implémentations dans [`backend/src/`](../backend/src/) :

- [`odds/odds.service.ts`](../backend/src/odds/odds.service.ts) — calcul cotes initiales et dynamiques
- [`wallet/wallet.service.ts`](../backend/src/wallet/wallet.service.ts) — service transactionnel solde
- [`bets/bets.service.ts`](../backend/src/bets/bets.service.ts) — placement de pari
- [`matches/admin-matches.service.ts`](../backend/src/matches/admin-matches.service.ts) — règlement / annulation
- [`daily-bonus/daily-bonus.service.ts`](../backend/src/daily-bonus/daily-bonus.service.ts) — cron bonus

---

## G. Frontend React

### G.1 Arborescence

```
src/
├── api/                # client axios + endpoints
├── hooks/              # useAuth, useMatches, usePlaceBet, useBalance, useLeaderboard, useSse
├── pages/              # Login, Register, Dashboard, Matches, MatchDetail, History, Leaderboard, admin/*
├── components/         # layout, matches, bets, wallet, leaderboard, ui
├── store/              # zustand authStore
└── lib/                # format, permissions
```

### G.2 Stratégie state & temps réel

- **TanStack Query** pour toutes les requêtes.
- **SSE** sur `/api/v1/realtime/stream` :
  - `match.odds` → mise à jour cache `matches`
  - `match.settled` → invalide `bets.me`, `wallet.balance`, `leaderboard`
  - `leaderboard.invalidate` → invalide `leaderboard`
- **Polling fallback** : `refetchInterval: 10_000` si SSE coupé.

### G.3 Hook `usePlaceBet`

```tsx
export function usePlaceBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: placeBet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['bets', 'me'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'balance'] });
    },
  });
}
```

### G.4 Composant `BetForm` (extrait)

```tsx
export function BetForm({ match }: Props) {
  const balance = useBalance();
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState(50);
  const placeBet = usePlaceBet();

  const odds = pick === match.playerAId ? match.oddsA : match.oddsB;
  const potentialWin = pick ? Math.floor(stake * odds) : 0;
  const canSubmit = pick && stake >= 10 && stake <= balance.data;

  return (
    <form onSubmit={e => { e.preventDefault(); placeBet.mutate({ matchId: match.id, pickedPlayerId: pick!, stake }); }}>
      <PlayerPicker match={match} value={pick} onChange={setPick} />
      <StakeInput value={stake} max={balance.data} onChange={setStake} />
      <PotentialWinDisplay stake={stake} odds={odds} potentialWin={potentialWin} />
      <Button disabled={!canSubmit || placeBet.isPending}>Confirmer</Button>
    </form>
  );
}
```

---

## H. Flux complet d'un pari

```
[USER]                       [FRONT]                        [BACK]                          [DB]
  │                            │                              │                               │
  │  voit la liste de matchs   │  GET /matches                │                               │
  │ ───────────────────────►   │ ───────────────────────────► │  SELECT matches OPEN          │
  │                            │ ◄─────────────────────────── │ ◄──────────────────────────── │
  │  clique « Parier »         │                              │                               │
  │  choisit joueur, stake     │  (calcul gain potentiel)     │                               │
  │  clique Confirmer          │  POST /bets                  │                               │
  │ ──────────►                │ ───────────────────────────► │  TX SERIALIZABLE              │
  │                            │                              │   SELECT match FOR UPDATE     │
  │                            │                              │   vérifs (status, début…)     │
  │                            │                              │   pas de PENDING existant     │
  │                            │                              │   crée Bet (oddsAtBet figée)  │
  │                            │                              │   SELECT user FOR UPDATE      │
  │                            │                              │   débite balance              │
  │                            │                              │   insert PointTransaction     │
  │                            │                              │   recalcule odds              │
  │                            │                              │   update match + snapshot     │
  │                            │                              │  COMMIT                       │
  │                            │                              │  SSE broadcast match.odds     │
  │                            │ ◄─────────────────────────── │                               │
  │                            │  invalidate caches           │                               │
  │                            │                              │                               │
  │  ... le match commence ... │   cron auto-locker:          │                               │
  │                            │   match.status = LOCKED      │                               │
  │                            │                              │                               │
  │  [ADMIN] saisit winner     │  POST /admin/matches/:id/settle                              │
  │                            │ ───────────────────────────► │  TX                           │
  │                            │                              │   loop bets PENDING           │
  │                            │                              │     WON  → +payout + tx       │
  │                            │                              │     LOST → tx audit           │
  │                            │                              │   match.status = SETTLED      │
  │                            │                              │  COMMIT                       │
  │                            │                              │  SSE leaderboard.invalidate   │
```

---

## I. Bonus

### I.1 SSE

```ts
@Controller('realtime')
export class RealtimeController {
  constructor(private gw: RealtimeGateway) {}
  @Sse('stream')
  stream(): Observable<MessageEvent> { return this.gw.stream$; }
}
```

### I.2 Anti-triche

- Lock auto des paris 2 min avant `startsAt` (cron 30 s).
- Rate-limit : 10 paris/minute/user (Nest `ThrottlerGuard`).
- Audit complet via `PointTransaction` ; réconciliation périodique `SUM(amount) == balance`.
- Tout ajustement admin → `ADMIN_ADJUSTMENT` avec `reason`.

### I.3 Historique des cotes

Couvert par `OddsSnapshot` + endpoint `/matches/:id/odds-history` + graphique côté front.

### I.4 Jobs planifiés

| Cron | Action |
|---|---|
| `0 6 * * *` | Distribution bonus quotidien |
| `*/30 * * * * *` | Lock auto des matchs 2 min avant début |
| `0 3 * * *` | Sanity check `SUM(transactions) == balance` |

### I.5 Tests unitaires critiques

| Fichier | Cas |
|---|---|
| `odds.service.spec.ts` | seedA<seedB → oddsA<oddsB ; bornes ; convergence du lissage ; pA+pB=1 |
| `bets.service.spec.ts` | solde insuffisant, match LOCKED, double pari, cote figée, débit, totaux |
| `wallet.service.spec.ts` | concurrence (2 paris simultanés) ne descend jamais sous 0 |
| `admin-matches.service.spec.ts` | gagnants crédités correctement, perdants non re-débités, idempotent |
| `daily-bonus.service.spec.ts` | un seul bonus par jour ; pas de bonus si aucun match |
| `bets.e2e.ts` | parcours complet POST /bets → settle |

### I.6 Cas limites

- Match `CANCELLED` : remboursement intégral via `ADMIN_ADJUSTMENT`.
- Correction d'un winner après `SETTLED` : interdit. Procédure = cancel + recréer.
- Joueur supprimé : interdit s'il apparaît dans des matchs non `CANCELLED`.
- Username case-insensitive : `LOWER(username) UNIQUE`.
- Mise > solde au moment T : `FOR UPDATE` + recheck.
- SSE coupé : reconnexion auto + fallback polling 10 s.
- Horloge : tous les checks `startsAt vs now()` côté serveur uniquement.
- Cotes saturées : warning loggé, le marché continue.

---

## J. Récapitulatif

| Sujet | Décision |
|---|---|
| ORM | Prisma |
| Temps réel | SSE |
| Monnaie | `Int` partout |
| Concurrence | `SERIALIZABLE` + `SELECT FOR UPDATE` |
| Auth | JWT httpOnly cookie, bcrypt |
| Cotes | Sigmoid + lissage exponentiel + market mix borné à 60% |
| Lock paris | 2 min avant le début, cron |
| Bonus | Cron 06:00, 1/jour, conditionné à un match prévu |
| Audit | Toute mutation = 1 ligne `PointTransaction` avec `balanceAfter` |
| Admin | Pages séparées, `RolesGuard('ADMIN')` |
