import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getInventoryReservations, releaseInventoryReservation, type InventoryReservation } from '@/src/lib/adminOrders';

export function ReservationPanel() {
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setReservations(await getInventoryReservations()); }
    catch (error) { console.error(error); toast.error('Unable to load inventory reservations.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const exceptions = reservations.filter(item => item.isExpired || item.status === 'requires_review');
  const active = reservations.filter(item => item.status === 'reserved' && !item.isExpired);

  const release = async (id: string) => {
    setReleasing(id);
    try { await releaseInventoryReservation(id); toast.success('Reservation released.'); await load(); }
    catch (error) { console.error(error); toast.error('Unable to release this reservation.'); }
    finally { setReleasing(null); }
  };

  return (
    <div className="card-premium p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold/50 font-black">Inventory Reservations</p><p className="text-sm text-brand-parchment/40">{active.length} active · {exceptions.length} require attention</p></div>
        <button onClick={load} disabled={loading} className="text-brand-gold disabled:opacity-40" aria-label="Refresh reservations"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {exceptions.map(reservation => (
        <div key={reservation.id} className="border border-red-400/20 bg-red-400/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3"><AlertTriangle className="text-red-300 shrink-0" size={17} /><div><p className="text-sm text-brand-parchment font-black">Expired or stuck reservation</p><p className="text-xs text-brand-parchment/50">{reservation.customerEmail || reservation.id} · {reservation.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</p></div></div>
          <button onClick={() => release(reservation.id)} disabled={releasing !== null} className="px-4 py-2 border border-red-400/30 text-red-200 text-[9px] uppercase tracking-[0.18em] font-black disabled:opacity-40">{releasing === reservation.id ? 'Releasing...' : 'Release Stock'}</button>
        </div>
      ))}
      {!loading && exceptions.length === 0 && <p className="text-xs text-brand-parchment/35">No expired or stuck reservations.</p>}
    </div>
  );
}
