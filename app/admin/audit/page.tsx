import { requireAdmin } from '@/lib/auth';
import { listAudit } from '@/lib/audit';
import { fmtDateTime } from '@/lib/format';
import type { AuditAction } from '@/lib/types';

const ACTION_LABEL: Record<AuditAction, string> = {
  MATCH_OPEN: 'Match ouvert aux paris',
  MATCH_LOCK: 'Match verrouillé',
  MATCH_SETTLE: 'Match réglé',
  MATCH_CANCEL: 'Match annulé',
  MATCH_CREATE: 'Match créé',
  MATCH_UPDATE: 'Match mis à jour',
  PLAYER_CREATE: 'Joueur créé',
  PLAYER_UPDATE: 'Joueur mis à jour',
  PLAYER_DELETE: 'Joueur supprimé',
  TOURNAMENT_OPEN: 'Tournoi ouvert',
  TOURNAMENT_LOCK: 'Tournoi verrouillé',
  TOURNAMENT_CANCEL: 'Tournoi annulé',
  TOURNAMENT_SETTLE: 'Tournoi réglé',
  USER_PROMOTE: 'User promu admin',
  USER_DEMOTE: 'Admin rétrogradé',
  USER_ADJUST_BALANCE: 'Ajustement de solde',
};

export default async function AuditPage() {
  await requireAdmin();
  const entries = await listAudit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Journal admin</h1>
      {entries.length === 0 ? (
        <div className="card text-sm text-fg/60">Aucune action enregistrée.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-stack w-full text-sm md:min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Cible</th>
                <th className="px-3 py-2">Détails</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td data-label="Date" className="px-3 py-2 text-fg/60">
                    {fmtDateTime(e.createdAt)}
                  </td>
                  <td data-label="Admin" className="px-3 py-2 font-medium">
                    {e.adminUsername}
                  </td>
                  <td data-label="Action" className="px-3 py-2">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td data-label="Cible" className="px-3 py-2 text-fg/70">
                    {e.targetLabel ?? e.targetId ?? '—'}
                  </td>
                  <td data-label="Détails" className="px-3 py-2 text-xs text-fg/60">
                    {e.metadata ? (
                      <code className="font-mono">
                        {JSON.stringify(e.metadata)}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
