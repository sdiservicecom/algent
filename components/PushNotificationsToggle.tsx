'use client';

import { useEffect, useState } from 'react';

type Status =
  | 'unsupported'
  | 'denied'
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'unsubscribing'
  | 'error';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationsToggle() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? 'subscribed' : 'idle');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'register-failed');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    setError(null);
    setStatus('subscribing');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'idle');
        return;
      }
      const res = await fetch('/api/push/vapid-public-key');
      if (!res.ok) throw new Error('vapid-key-unavailable');
      const { publicKey } = (await res.json()) as { publicKey: string };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const save = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!save.ok) throw new Error('save-failed');
      setStatus('subscribed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'subscribe-failed');
      setStatus('error');
    }
  };

  const unsubscribe = async () => {
    setError(null);
    setStatus('unsubscribing');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unsubscribe-failed');
      setStatus('error');
    }
  };

  if (status === 'unsupported') {
    return (
      <div className="card text-sm text-white/60">
        Les notifications push ne sont pas supportées par ce navigateur (sur
        iOS, ajoute l'app à l'écran d'accueil pour les activer).
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="card text-sm text-danger">
        Notifications bloquées. Autorise-les dans les réglages du navigateur
        puis recharge la page.
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 text-sm">
      <div>
        <div className="font-medium">Notifications de résultats</div>
        <div className="text-white/60">
          Reçois une notif système dès qu'un de tes paris est validé.
        </div>
      </div>
      {status === 'subscribed' ? (
        <button
          type="button"
          onClick={unsubscribe}
          className="btn-secondary"
          disabled={status !== 'subscribed'}
        >
          Désactiver
        </button>
      ) : (
        <button
          type="button"
          onClick={subscribe}
          className="btn-primary"
          disabled={status === 'subscribing'}
        >
          {status === 'subscribing' ? 'Activation…' : 'Activer'}
        </button>
      )}
      {error && (
        <p className="basis-full text-xs text-danger">Erreur : {error}</p>
      )}
    </div>
  );
}
