import React from 'react';
import { createPortal } from 'react-dom';
import logo from '@/src/assets/brand/boanerges-stacked-lockup-black.png';
import type { Order } from './DashboardView';
import { buildConsolidatedPickList, getPackingSlipItems, shortOrderReference } from '@/src/lib/fulfillmentDocuments';

export type FulfillmentPrintJob =
  | { type: 'packing-slip'; order: Order; qrDataUrl: string }
  | { type: 'pick-list'; orders: Order[] };

const orderDate = (value: any) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date unavailable';
};

const addressLines = (order: Order) => [
  order.shippingAddress?.name || order.customerName,
  order.shippingAddress?.line1,
  order.shippingAddress?.line2,
  [order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.postalCode].filter(Boolean).join(', '),
  order.shippingAddress?.country,
].filter(Boolean);

const PackingSlip: React.FC<{ order: Order; qrDataUrl: string }> = ({ order, qrDataUrl }) => {
  const items = getPackingSlipItems(order);
  return (
    <article className="print-page packing-slip">
      <header className="print-header">
        <img src={logo} alt="Boanerges Provisions Co." />
        <div><p className="print-kicker">Packing Slip</p><h1>Order {shortOrderReference(order)}</h1><p>{orderDate(order.createdAt)}</p></div>
      </header>

      <section className="print-two-column">
        <div><h2>Ship To</h2>{addressLines(order).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
        <div><h2>Order Contact</h2><p>{order.customerEmail}</p>{order.customerPhone && <p>{order.customerPhone}</p>}</div>
      </section>

      <table className="print-table">
        <thead><tr><th>Product ID</th><th>Item</th><th>Size</th><th className="print-number">Pack</th></tr></thead>
        <tbody>{items.map((item, index) => (
          <tr key={`${item.productId || item.name}-${index}`}>
            <td className="print-mono">{item.productId || '—'}</td><td>{item.name || 'Unnamed item'}{item.itemType === 'bundle' && item.components?.length ? <small style={{ display: 'block' }}>{item.components.map(component => `${component.quantity}× ${component.name}`).join(' · ')}</small> : null}</td><td>{item.sizeOz ? `${item.sizeOz} oz` : '—'}</td><td className="print-number print-quantity">{item.fulfillQuantity}</td>
          </tr>
        ))}</tbody>
      </table>
      {!items.length && <p className="print-empty">No quantities remain to be packed for this order.</p>}

      <section className="print-instructions">
        <h2>Internal Packing Instructions</h2>
        <p>{order.adminNotes || 'No special packing instructions.'}</p>
        <small>Internal fulfillment copy. Review before placing paperwork in the customer’s package.</small>
      </section>

      <footer className="print-footer">
        <div><img src={qrDataUrl} alt={`QR code for order ${shortOrderReference(order)}`} /><p>Scan to open this order in the secure admin portal.</p></div>
        <div className="print-checks"><span>□ Items checked</span><span>□ Package sealed</span><span>□ Label matched</span></div>
      </footer>
    </article>
  );
};

const PickList: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const items = buildConsolidatedPickList(orders);
  return (
    <article className="print-page pick-list">
      <header className="print-header">
        <img src={logo} alt="Boanerges Provisions Co." />
        <div><p className="print-kicker">Fulfillment</p><h1>Consolidated Pick List</h1><p>{new Date().toLocaleString('en-US')}</p></div>
      </header>
      <section className="print-summary"><strong>{orders.length}</strong> orders · <strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong> units</section>
      <table className="print-table">
        <thead><tr><th>Picked</th><th>Product ID</th><th>Product</th><th>Size</th><th>Orders</th><th className="print-number">Total Units</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={`${item.productId}-${item.sizeOz}`}><td className="print-checkbox">□</td><td className="print-mono">{item.productId}</td><td>{item.name}</td><td>{item.sizeOz ? `${item.sizeOz} oz` : '—'}</td><td>{item.orderCount}</td><td className="print-number print-quantity">{item.quantity}</td></tr>
        ))}</tbody>
      </table>
      <section className="print-order-references"><h2>Included Orders</h2><p>{orders.map(order => shortOrderReference(order)).join(' · ')}</p></section>
      <footer className="print-signoff"><span>Picked by: ____________________</span><span>Date/time: ____________________</span></footer>
    </article>
  );
};

export const FulfillmentPrintDocuments: React.FC<{ job: FulfillmentPrintJob | null }> = ({ job }) => {
  if (!job || typeof document === 'undefined') return null;
  return createPortal(
    <div className="admin-print-root" aria-hidden="true">
      {job.type === 'packing-slip' ? <PackingSlip order={job.order} qrDataUrl={job.qrDataUrl} /> : <PickList orders={job.orders} />}
    </div>,
    document.body,
  );
};
