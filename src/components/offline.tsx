'use client';
import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';

/**
 * Regista o service worker que permite abrir a demo sem rede e mostra
 * uma faixa quando o navegador comunica que está offline.
 */
export function OfflineWatcher() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sem service worker a demo funciona, apenas não abre a frio sem rede.
      });
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      <CloudOff size={16} />
      <span>
        Sem ligação. Continua a registar normalmente: as operações ficam na fila de envio até haver
        rede.
      </span>
    </div>
  );
}
