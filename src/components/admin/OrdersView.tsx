import React from 'react';
import { MoreVertical } from 'lucide-react';
import { db, doc, updateDoc } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { Order } from './DashboardView';

interface OrdersViewProps {
  orders: Order[];
  onRefresh: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, onRefresh }) => {
  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      onRefresh();
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="card-premium overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Transaction ID</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Date</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Customer</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Total</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Status</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <span className="text-xs font-mono text-brand-gold/60 tracking-wider">#{order.id.slice(0, 8).toUpperCase()}</span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-xs text-brand-parchment/60 font-medium">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </td>
                <td className="px-10 py-8">
                  <div className="space-y-1">
                    <p className="text-sm text-brand-parchment font-black">{order.customerEmail}</p>
                    <p className="text-[9px] text-brand-parchment/30 uppercase tracking-widest font-bold">Verified Customer</p>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <span className="text-base text-brand-parchment font-black tracking-tighter">${order.totalAmount?.toFixed(2)}</span>
                </td>
                <td className="px-10 py-8">
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className={cn(
                      "input-premium py-1.5 px-4 text-[9px] uppercase tracking-[0.2em] font-black cursor-pointer w-auto min-w-[140px]",
                      order.status === 'delivered' ? 'text-green-400 border-green-400/20' :
                      order.status === 'shipped' ? 'text-blue-400 border-blue-400/20' :
                      order.status === 'processing' ? 'text-purple-400 border-purple-400/20' :
                      'text-brand-gold border-brand-gold/20'
                    )}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-10 py-8 text-right">
                  <button className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
