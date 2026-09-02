import React from 'react';
import { motion } from 'motion/react';
import { DollarSign, ShoppingCart, Package, AlertCircle, TrendingUp, PackageCheck } from 'lucide-react';
import { Product } from '@/src/services/productService';
import type { FulfillmentState, PaymentState, ShipmentState } from '@/src/lib/orderLifecycle';

export interface Order {
  id: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number;
  subtotalAmount?: number;
  shippingAmount?: number;
  taxAmount?: number;
  refundedAmount?: number;
  shippingMethod?: string;
  shippingRateId?: string;
  stripeChargeId?: string;
  stripeDisputeId?: string;
  disputeStatus?: string;
  disputeReason?: string;
  lifecycleVersion?: number;
  paymentStatus?: PaymentState;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  carrier?: string;
  shippingService?: string;
  shipmentCost?: number;
  estimatedDelivery?: string;
  shippoTransactionId?: string;
  resendEmailStatus?: string;
  resendEmailId?: string;
  shipmentEmailStatus?: string;
  shipmentEmailId?: string;
  shipmentEmailError?: string;
  deliveredEmailStatus?: string;
  delayedEmailStatus?: string;
  exceptionEmailStatus?: string;
  latestTransactionalEmail?: { type: 'shipment' | 'delivered' | 'delayed' | 'exception'; status: string; providerId?: string; error?: string };
  latestTrackingStatus?: { status: string; details?: string; statusDate?: string };
  shipmentStatus?: ShipmentState;
  shipmentException?: { status: string; type: string; quoteId?: string; message: string };
  adminNotes?: string;
  paidAt?: any;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  originalShippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  status?: string;
  fulfillmentStatus?: FulfillmentState;
  createdAt: any;
  items: any[];
}

interface DashboardViewProps {
  stats: any;
  orders: Order[];
  products: Product[];
  onViewOrders: () => void;
  onManageInventory: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ stats, orders, products, onViewOrders, onManageInventory }) => {
  return (
    <div className="space-y-16 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {[
            { label: 'Total Revenue', value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-green-400', glow: 'shadow-green-400/10' },
            { label: 'Total Orders', value: stats.orderCount, icon: ShoppingCart, color: 'text-blue-400', glow: 'shadow-blue-400/10' },
            { label: 'Total Products', value: stats.productCount, icon: Package, color: 'text-brand-gold', glow: 'shadow-brand-gold/10' },
            { label: 'Low Stock Items', value: stats.lowStock, icon: AlertCircle, color: 'text-red-400', glow: 'shadow-red-400/10' },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`card-premium p-10 space-y-6 relative group ${stat.glow}`}
            >
              <div className="flex justify-between items-start">
                <div className={`p-4 rounded-sm bg-white/5 ${stat.color} group-hover:scale-110 transition-transform duration-700 shadow-inner`}>
                  <stat.icon size={22} strokeWidth={1.5} />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-400/5 text-green-400 text-[9px] font-black tracking-widest">
                  <TrendingUp size={10} />
                  +12%
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">{stat.label}</p>
                <h3 className="text-4xl font-serif text-brand-parchment group-hover:text-brand-gold transition-colors duration-500">{stat.value}</h3>
              </div>
              <div className="pt-4 border-t border-white/5">
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '70%' }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className={`h-full bg-gradient-to-r from-transparent to-current ${stat.color}`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Recent Orders */}
        <div className="xl:col-span-2 card-premium overflow-hidden">
          <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-brand-parchment">Recent Transactions</h3>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Latest customer orders</p>
            </div>
            <button onClick={onViewOrders} className="text-[10px] uppercase tracking-[0.3em] font-black text-brand-gold hover:text-brand-parchment transition-all duration-500 border border-brand-gold/20 px-6 py-2.5 rounded-sm hover:bg-brand-gold/10">View All Orders</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Order ID</th>
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Customer</th>
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Amount</th>
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.slice(0, 6).map((order) => {
                  const orderStatus = order.fulfillmentStatus || 'pending';
                  const totalAmount = order.totalAmount ?? 0;

                  return (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-6 text-[11px] text-brand-parchment font-mono tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">#{order.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-10 py-6 text-[11px] text-brand-parchment/80 font-medium">{order.customerName || order.customerEmail}</td>
                    <td className="px-10 py-6 text-sm text-brand-parchment font-black tracking-tight">${totalAmount.toFixed(2)}</td>
                    <td className="px-10 py-6 text-right">
                      <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] uppercase tracking-[0.2em] font-black border ${
                        order.shipmentStatus === 'delivered' ? 'bg-green-400/5 text-green-400 border-green-400/10' :
                        orderStatus === 'packed' || orderStatus === 'shipped' ? 'bg-blue-400/5 text-blue-400 border-blue-400/10' :
                        orderStatus === 'requires_attention' ? 'bg-red-400/5 text-red-400 border-red-400/10' :
                        'bg-brand-gold/5 text-brand-gold border-brand-gold/10'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          order.shipmentStatus === 'delivered' ? 'bg-green-400' :
                          orderStatus === 'packed' || orderStatus === 'shipped' ? 'bg-blue-400' :
                          orderStatus === 'requires_attention' ? 'bg-red-400' :
                          'bg-brand-gold'
                        }`} />
                        F: {orderStatus.replaceAll('_', ' ')} · S: {(order.shipmentStatus || 'not_shipped').replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="card-premium overflow-hidden">
          <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-brand-parchment">Stock Alerts</h3>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Low inventory monitoring</p>
            </div>
          </div>
          <div className="p-10 space-y-8">
            {products.filter(p => p.currentInventory < 15).slice(0, 6).map((product) => (
              <div key={product.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-brand-gold/10 rounded-sm blur opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img src={product.imageUrl} className="w-14 h-14 object-cover rounded-sm border border-white/10 relative z-10 group-hover:scale-105 transition-transform duration-500" alt={product.name} />
                  </div>
                  <div>
                    <p className="text-[13px] text-brand-parchment font-black group-hover:text-brand-gold transition-colors">{product.name}</p>
                    <p className="text-[9px] text-brand-parchment/30 uppercase tracking-[0.2em] font-bold">{product.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-serif ${product.currentInventory < 5 ? 'text-red-400' : 'text-brand-gold'}`}>{product.currentInventory}</p>
                  <p className="text-[8px] text-brand-parchment/30 uppercase tracking-widest font-black">Units Left</p>
                </div>
              </div>
            ))}
            {products.filter(p => p.currentInventory < 15).length === 0 && (
              <div className="text-center py-20 space-y-6">
                <div className="w-20 h-20 bg-green-400/5 rounded-full flex items-center justify-center mx-auto border border-green-400/10">
                  <PackageCheck size={32} className="text-green-400/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-brand-parchment text-sm font-black uppercase tracking-widest">Inventory Optimized</p>
                  <p className="text-brand-parchment/30 text-[11px] font-light italic">All stock levels are currently healthy.</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-8 bg-white/[0.01] border-t border-white/5">
            <button onClick={onManageInventory} className="w-full py-4 text-[10px] uppercase tracking-[0.3em] font-black text-brand-gold hover:text-brand-parchment hover:bg-brand-gold/5 transition-all duration-500 rounded-sm">Manage Inventory</button>
          </div>
        </div>
      </div>
    </div>
  );
};
