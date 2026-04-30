# Audit Algent — ce qui manque pour atteindre la production

Snapshot d'analyse à date du commit courant. Trois grandes catégories
classées par impact.

---

## 1. Robustesse / production-grade (priorité haute)

Risques réels avant ouverture du tournoi. À traiter en premier.

### 1.1 Aucun test

Le système manipule des points en concurrence (`applyWalletDelta`,
`placeBet`, `settleMatch`, `placeComboBet`, `propagateBracketWinner`).
Aucun test ne le couvre.

À écrire en priorité :

- `lib/wallet.spec.ts` : delta négatif rolls back proprement, deux delta
  concurrents ne descendent jamais sous 0.
- `lib/bets.spec.ts` : double-clic ne crée pas deux paris (`SET NX`),
  débit + cote figée + recompute en séquence cohérente, rollback du
  guard si `WalletError`.
- `lib/combos.spec.ts` : tous les chemins de `resolveCombosForMatch`
  (WON / LOST / CANCELLED, sister settled, all-CANCELLED edge case),
  refus de placer un combo avec match clos.
- `lib/matches.spec.ts` : `propagateBracketWinner` couvre slot impair /
  pair, sister non réglé, prochain match déjà existant avec mises (on
  ne touche pas).
- `lib/odds.spec.ts` : `recomputeOdds` reste dans `[ODDS_MIN, ODDS_MAX]`
  pour des seeds extrêmes, lissage converge.

Cible : 60 % de couverture sur `lib/`, vert sur CI au push.

### 1.2 Pas d'atomicité multi-clés

Vercel KV (Upstash Redis) n'a pas de transaction multi-keys. `placeBet`
écrit ~6 clés en série ; un crash entre l'étape 3 et 4 laisse de la
donnée orpheline (guard pris, bet créé, débit fait, mais ZSET non
mis à jour).

Solutions, par ordre d'effort :

1. Lua scripts Upstash pour les chemins critiques (`placeBet`,
   `applyWalletDelta` + rollback, `settleMatch` per-bet). Atomique au
   niveau Redis.
2. Stocker l'agrégat par utilisateur dans un seul JSON (
   `algent:user-state:{id}`) qu'on `GET` puis `SET` avec un compare-
   and-swap (via `SET ... IF` Upstash). Un seul write critique.
3. À défaut : ajouter un cron `*/15min` qui détecte et corrige les
   incohérences (réconciliation `SUM(transactions) == balance`).

### 1.3 Idempotence absente sur combos et batch

Double-clic = double pari. Le placement simple a une garde
`SET NX algent:bets:pending:{userId}:{matchId}`, mais :

- `placeComboBet` n'a aucune garde — un user peut envoyer 2 fois la
  même requête, payer 2× la mise.
- `/api/bets/batch` exécute les paris en série sans token
  d'idempotence ; un retry HTTP peut tout dupliquer.

Fix : accepter un header `Idempotency-Key` (UUID généré côté client) et
le `SET NX` côté serveur avec TTL 60s, refuser si la clé existe déjà.

### 1.4 Rate limiting

Aucun. Quelqu'un peut hammer `/api/bets/batch`, `/login`, ou
`/api/notifications` à la milliseconde. Upstash propose une lib
`@upstash/ratelimit` plug-and-play (10 lignes) :

```ts
const limit = new Ratelimit({ redis: kv, limiter: Ratelimit.slidingWindow(20, '1 m') });
const { success } = await limit.limit(`user:${session.sub}`);
if (!success) return new Response('Too many', { status: 429 });
```

Endpoints à couvrir : `/api/bets/*`, `/api/auth/*` (login surtout, brute-
force), server actions `register` et `login`.

### 1.5 Le rollback wallet peut leak

`applyWalletDelta` fait `HINCRBY -X` puis si `< 0` un `HINCRBY +X` pour
compenser. Si le 2ᵉ `HINCRBY` échoue (réseau coupé pile entre les
deux), le solde reste négatif et la lecture suivante peut servir
ce solde pourri.

Fix : Lua script qui fait check-and-decrement en une étape (`return
nil` si insuffisant, sinon décrémente et retourne le nouveau solde).
Aucun rollback nécessaire.

### 1.6 Sécurité auth

- Pas de rate-limit sur `/login` → bruteforce trivial.
- Pas de protection CSRF explicite sur les API routes JSON (les Server
  Actions de Next.js sont protégées par défaut, pas les routes
  manuelles). Cookie `SameSite=Lax` mitige mais n'élimine pas.
- bcrypt cost 10 — OK, pourrait passer à 12 si performance suffit.
- Pas de rotation du `AUTH_SECRET` (changer le secret invalide toutes
  les sessions, c'est attendu, mais pas documenté).

### 1.7 Imports circulaires

`lib/matches.ts` ↔ `lib/combos.ts`. Marche aujourd'hui parce que les
fonctions ne sont appelées qu'à l'exécution, mais une importation au
top-level (constante calculée d'un autre module) casserait. À refacto
en sortant la chaîne d'effets de settlement (combos + bracket + notifs)
dans un `lib/settlement.ts` orchestrateur.

---

## 2. Manques fonctionnels (priorité moyenne)

À shipper avant ou pendant le tournoi pour le confort des utilisateurs.

### 2.1 Profil utilisateur

Aucune page de modification :

- Changer son mot de passe.
- Modifier prénom / nom / pseudo (avec garde sur l'unicité).
- Voir son propre récap (paris totaux, ROI, joueur fétiche).
- Pas de "mot de passe oublié" (acceptable pour un app interne mais
  problématique si l'admin part en congés).

### 2.2 Statistiques perso

L'app stocke tout (`Bet`, `OddsSnapshot`, `PointTransaction`,
`ComboBet`, `TournamentBet`) mais ne montre presque rien à
l'utilisateur :

- ROI cumulé (`totalWon / totalStaked - 1`) sur la durée.
- Taux de réussite par phase (huitième, quart…).
- Joueur sur lequel l'utilisateur mise le plus.
- Courbe de solde dans le temps (sparkline sur le dashboard).

Tout est calculable depuis les ZSET existants, ~1 jour de boulot pour
une vraie page `/stats`.

### 2.3 Graphique d'historique des cotes

`OddsSnapshot` est persisté à chaque pari mais jamais affiché. Un mini
graph SVG sur la page match (cotes A et B au cours du temps) donnerait
beaucoup de profondeur. ~half-day avec recharts ou un SVG custom.

### 2.4 Modification d'un match existant

Admin ne peut que créer / régler / annuler. Impossible de :

- Changer la date / heure.
- Reporter un match.
- Changer un joueur si erreur de saisie (ou si le tirage initial était
  faux).
- Re-régler un match déjà SETTLED en cas d'erreur (la procédure
  actuelle = annuler + recréer + reprendre tous les paris, douloureux).

### 2.5 Gestion des rôles

- Le 1er inscrit devient ADMIN auto. Aucune UI pour promouvoir un
  USER → ADMIN ou rétrograder. En cas d'absence de l'admin initial,
  blocage total.
- Aucune fonction "ajouter des points à un user" depuis l'UI (la spec
  mentionne `ADMIN_ADJUSTMENT`, le code l'utilise pour les
  remboursements internes mais l'admin n'a pas de bouton).

### 2.6 Audit log admin

Pas de trace de "qui a réglé quel match à quelle heure", "qui a annulé
le tournoi". Pour un usage entreprise, indispensable en cas de
litige.

Nouvelle table KV `algent:audit:{ulid}` avec
`{ adminId, action, target, before, after, at }`, listing dans
`/admin/audit`.

### 2.7 PWA installable

Manifest, icônes, splash screen — tout manque. Pour un app interne
qu'on consulte au téléphone pendant un tournoi, l'expérience "Add to
Home Screen" est très attendue.

10 lignes de manifest + 2 icônes 192/512 et c'est plié.

### 2.8 Filtrage et recherche

- Liste des matchs : pas de filtre par statut / phase / joueur.
- Historique perso : pas de filtre par statut, période, type
  (individuel / combo / tournoi).
- Leaderboard : pas de pagination (mortel à >50 joueurs).

### 2.9 Annulation par utilisateur (cash-out)

Aucun moyen pour l'utilisateur d'annuler un pari pendant la phase
`OPEN_FOR_BETS` (avant lock). Soit on l'autorise (sans pénalité ou
avec frais de 5 %), soit on documente clairement que c'est non.

---

## 3. Polish & opérationnel (priorité basse)

Confort visible mais sans risque.

### 3.1 UX

- Pages d'erreur custom (500 / 404 / unauthorized) en respectant la
  charte.
- Toasts au lieu des `?error=...` / `?ok=1` pour le feedback (la
  page se recharge à chaque action).
- Indicateur visuel/sonore quand une nouvelle notif arrive (pulse de
  la cloche, son très léger).
- Animation de transition entre les routes (Next.js `loading.tsx`).
- Focus trap dans la popover des notifs et dans le panier flottant.
- Empty states plus accueillants (illustration / call-to-action).

### 3.2 Accessibilité

- Pas de `aria-label` sur la majorité des boutons icône.
- Contrastes OK sur la palette claire mais à valider avec un tool
  (WCAG AA visé).
- `prefers-reduced-motion` ignoré (le burst de pouces continue à
  spammer même si l'utilisateur a coché "réduire les animations").

### 3.3 Monitoring

Pas de Sentry / Better Stack / autre. Les erreurs serveur en prod sont
visibles uniquement dans les logs Vercel, sans agrégation.

Sentry gratuit jusqu'à 5k events/mois, à brancher en 5 minutes.

### 3.4 CI

Pas de GitHub Action. Au minimum :

- `npm run lint`
- `tsc --noEmit`
- (plus tard) `npm test`

à chaque push, pour ne pas casser la prod sans s'en rendre compte.

### 3.5 Backups KV

Upstash garde des snapshots (1 / jour gratuit), mais pas de procédure
documentée pour restaurer en cas de corruption ou de suppression
accidentelle. Devrait au moins être noté dans le README.

### 3.6 Données de démonstration

Aucun seed dev pour reproduire un tournoi local : on se retrouve à
créer 16 joueurs et 8 matchs à la main pour tester. Un `npm run seed`
qui pose un tournoi factice serait précieux.

### 3.7 Performance

Pas urgent vu le volume (~100 utilisateurs interne) mais à noter :

- `getLeaderboard()` charge **tous les paris de tous les users** à
  chaque appel (poll 10 s). Pour 100 users × 50 paris = 5 000
  fetches KV par tick. À mémoïser ou agréger lors du settle.
- `propagateBracketWinner` fait un `listMatches` complet 1-2 fois.
  Indexer `algent:bracket:{round}:{slot}` → matchId rendrait le
  lookup O(1).
- Les listings `listAllTournamentBets`, `listMatchBets` sont en
  N+1 (un GET par bet). Acceptable jusqu'à ~200 paris par match.

---

## Priorisation suggérée

Si je devais shipper 3 choses avant l'ouverture du tournoi :

1. **Tests wallet + bets + combos** → blindage anti-régression.
2. **Rate limit + idempotence** → empêcher les bugs côté client / les
   doubles paris involontaires.
3. **Audit log admin + promotion ADMIN** → résilience côté ops.

Si ensuite tu vises le "wow", dans l'ordre :

4. Statistiques perso + courbe de solde.
5. Graphique d'évolution des cotes.
6. PWA installable + toasts.

Le reste peut attendre la v2.
