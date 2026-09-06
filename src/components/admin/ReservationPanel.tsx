import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getInventoryReservations, releaseInventoryReservation, type InventoryReservation } from '@/src/lib/adminOrders';

export function ReservationPanel({ refreshRevision = 0 }: { refreshRevision?: number }) {
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setReservations(await getInventoryReservations()); }
    catch (loadError) { console.error(loadError); setError('Unable to load inventory reservations. The status below may be incomplete.'); toast.error('Unable to load inventory reservations.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [refreshRevision]);
  const exceptions = reservations.filter(item => item.isExpired || item.status === 'requires_review');
  const active = reservations.filter(item => item.status === 'reserved' && !item.isExpired);

  const release = async (id: string) => {
    setReleasing(id);
    try { await releaseInventoryReservation(id); toast.success('Reservation released.'); await load(); }
    catch (error) { console.error(error); toast.error('Unable to release this reservation.'); }
    finally { setReleasing(null); }
  };

  if (!loading && !error && exceptions.length === 0) {
    return (
      <div className="card-premium px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 size={16} className="text-green-400 shrink-0" />
          <p className="text-xs text-brand-parchment/55 truncate"><span className="text-brand-parchment font-black">Inventory reservations healthy</span> · {active.length} active · 0 require attention</p>
        </div>
        <button onClick={load} className="text-brand-gold/60 hover:text-brand-gold" aria-label="Refresh reservations"><RefreshCw size={15} /></button>
      </div>
    );
  }

  return (
    <div className="card-premium p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold/50 font-black">Inventory Reservations</p><p className="text-sm text-brand-parchment/40">{active.length} active · {exceptions.length} require attention</p></div>
        <button onClick={load} disabled={loading} className="text-brand-gold disabled:opacity-40" aria-label="Refresh reservations"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {error && <div role="alert" className="border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      {exceptions.map(reservation => (
        <div key={reservation.id} className="border border-red-400/20 bg-red-400/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3"><AlertTriangle className="text-red-300 shrink-0" size={17} /><div><p className="text-sm text-brand-parchment font-black">Expired or stuck reservation</p><p className="text-xs text-brand-parchment/50">{reservation.customerEmail || reservation.id} · {reservation.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</p></div></div>
          <button onClick={() => release(reservation.id)} disabled={releasing !== null} className="px-4 py-2 border border-red-400/30 text-red-200 text-[9px] uppercase tracking-[0.18em] font-black disabled:opacity-40">{releasing === reservation.id ? 'Releasing...' : 'Release Stock'}</button>
        </div>
      ))}
    </div>
  );
}
