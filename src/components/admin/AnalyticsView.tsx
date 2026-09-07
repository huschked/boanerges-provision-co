import React, { useMemo, useState } from 'react';
import { buildAnalyticsData, type AnalyticsFilters } from '@/src/lib/adminAnalytics';
import type { ContactMessage } from './MessagesView';
import type { Order } from './DashboardView';
import type { Subscriber } from './SubscribersView';
import type { Product } from '@/src/services/productService';
import { DistributionBars, EmptyInsight, HorizontalBars, InsightCard, InsightPanel, StackedBars, TrendChart } from './analytics/ChartPrimitives';

type TrendMode = 'day' | 'week' | 'month';

interface AnalyticsViewProps {
  orders: Order[];
  products: Product[];
  subscribers: Subscriber[];
  messages: ContactMessage[];
}

const currency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ orders, products, subscribers, messages }) => {
  const [trendMode, setTrendMode] = useState<TrendMode>('month');
  const [filters, setFilters] = useState<AnalyticsFilters>({ dateWindow: '90d', productFilter: 'all' });
  const filterOptions = useMemo(() => {
    const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))) as string[];
    return [
      { value: 'all', label: 'All products' },
      ...categories.map((category) => ({ value: `category:${category}`, label: `${category} category` })),
      ...products.map((product) => ({ value: `product:${product.id}`, label: product.name })),
    ];
  }, [products]);
  const analytics = useMemo(
    () => buildAnalyticsData({ orders, products, subscribers, messages, filters }),
    [orders, products, subscribers, messages, filters]
  );

  const trendSeries = analytics.trends[trendMode];

  return (
    <div className="space-y-10 animate-fade-in">
      <section className="card-premium p-8 space-y-5">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/45 font-black">Analytics Overview</p>
          <h3 className="text-3xl font-serif text-brand-parchment">Sales, operations, and customer signals from live store data</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Date Window</span>
            <select
              value={filters.dateWindow}
              onChange={(event) => setFilters((current) => ({ ...current, dateWindow: event.target.value as AnalyticsFilters['dateWindow'] }))}
              className="input-premium py-3 w-full"
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="365d">Last 12 months</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Product / Category Focus</span>
            <select
              value={filters.productFilter}
              onChange={(event) => setFilters((current) => ({ ...current, productFilter: event.target.value }))}
              className="input-premium py-3 w-full"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-brand-parchment/45">
          <p>This admin view uses first-party Firestore orders, products, subscribers, and contact messages. Paid-order records remain the source of truth for revenue.</p>
          <p>GA4 owns traffic and storefront-funnel reporting. Meta owns advertising attribution and campaign optimization; those provider totals are not interchangeable with this operational view.</p>
          <p>Some cards will stay empty until more shipping, bundle, or repeat-customer history accumulates. Optional provider tracking also depends on each visitor’s cookie choices.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <InsightCard eyebrow="Revenue" title="Total Revenue" value={currency(analytics.summary.totalRevenue)} hint="Paid orders currently stored in Firestore." />
        <InsightCard eyebrow="Orders" title="Total Orders" value={analytics.summary.totalOrders.toString()} hint="Uses orders with paid totals or paid payment status." />
        <InsightCard eyebrow="Value" title="Average Order Value" value={currency(analytics.summary.averageOrderValue)} hint="Average total per paid order." />
        <InsightCard eyebrow="Units" title="Total Units Sold" value={analytics.summary.totalUnitsSold.toString()} hint="Summed from order line-item quantities." />
        <InsightCard eyebrow="Retention" title="Repeat Customer Rate" value={percent(analytics.summary.repeatCustomerRate)} hint={`${analytics.summary.repeatCustomerCount} customers have placed more than one order.`} />
        <InsightCard eyebrow="Inventory" title="Low-Stock Products" value={analytics.summary.lowStockProductCount.toString()} hint="Products at or below reorder threshold." />
      </div>

      <InsightPanel
        title="Revenue & Order Trends"
        subtitle="Sales cadence"
        action={
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as TrendMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setTrendMode(mode)}
                className={`px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-black transition-colors ${
                  trendMode === mode ? 'bg-brand-gold text-brand-black' : 'border border-white/10 text-brand-parchment/45 hover:text-brand-gold'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <TrendChart data={trendSeries.revenue} formatter={currency} />
          <TrendChart data={trendSeries.orders} formatter={(value) => `${value} orders`} accentClassName="text-brand-parchment" />
        </div>
      </InsightPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <InsightPanel title="Top Sellers by Units" subtitle="What is moving fastest">
          <HorizontalBars
            data={analytics.topProductsByUnits.map((item) => ({
              label: item.label,
              value: item.units,
              secondaryValue: currency(item.revenue),
            }))}
            formatter={(value) => `${value} units`}
            emptyTitle="No sales recorded yet"
            emptyDescription="Top sellers will appear after paid orders with line items are in Firestore."
          />
        </InsightPanel>

        <InsightPanel title="Top Sellers by Revenue" subtitle="What is making the most money">
          <HorizontalBars
            data={analytics.topProductsByRevenue.map((item) => ({
              label: item.label,
              value: item.revenue,
              secondaryValue: `${item.units} units sold`,
            }))}
            formatter={currency}
            emptyTitle="No revenue data yet"
            emptyDescription="Revenue rankings need paid orders with prices stored in order items."
          />
        </InsightPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <InsightPanel title="Sales Mix by Category" subtitle="Revenue distribution">
          <DistributionBars
            data={analytics.salesMixByCategory}
            formatter={currency}
            emptyTitle="Category mix unavailable"
            emptyDescription="This requires orders to reference products with category data."
          />
        </InsightPanel>

        <InsightPanel title="Sales Mix by Heat Level" subtitle="Flavor profile distribution">
          <DistributionBars
            data={analytics.salesMixByHeatLevel}
            formatter={currency}
            emptyTitle="Heat mix unavailable"
            emptyDescription="This requires heat-level values on products or order items."
          />
        </InsightPanel>

        <InsightPanel title="Orders by Shipping State" subtitle="Where customers are ordering from">
          <HorizontalBars
            data={analytics.ordersByRegion.map((item) => ({
              label: item.region,
              value: item.orders,
              secondaryValue: currency(item.revenue),
            }))}
            formatter={(value) => `${value} orders`}
            emptyTitle="Shipping geography is still sparse"
            emptyDescription="This view needs shipping state data from completed Stripe checkouts."
          />
        </InsightPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <InsightPanel title="New vs Returning Customers" subtitle="Retention signal over time">
          <StackedBars
            data={trendSeries.customers}
            emptyTitle="Not enough customer history yet"
            emptyDescription="This chart appears once orders include customer emails over multiple periods."
          />
        </InsightPanel>

        <InsightPanel title="Audience Growth" subtitle="Subscribers and inquiries">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-gold/35 font-black">Newsletter Signups</p>
              {trendSeries.subscribers.length ? (
                <TrendChart data={trendSeries.subscribers} formatter={(value) => `${value} signups`} />
              ) : (
                <EmptyInsight title="No subscriber timestamps yet" description="Subscriber growth requires createdAt data in the subscribers collection." />
              )}
            </div>
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-gold/35 font-black">Contact Inquiries</p>
              {trendSeries.inquiries.length ? (
                <TrendChart data={trendSeries.inquiries} formatter={(value) => `${value} inquiries`} accentClassName="text-brand-parchment" />
              ) : (
                <EmptyInsight title="No inquiry timestamps yet" description="Contact submission trends require createdAt values in contact_messages." />
              )}
            </div>
          </div>
        </InsightPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <InsightPanel title="Low-Stock Watchlist" subtitle="What needs restocking soon">
          {analytics.lowStockWatchlist.length ? (
            <div className="space-y-4">
              {analytics.lowStockWatchlist.slice(0, 8).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <p className="text-sm text-brand-parchment font-black">{product.name}</p>
                    <p className="text-[11px] text-brand-parchment/35">
                      {product.currentInventory} on hand · reorder at {product.reorderThreshold}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand-gold font-black">{product.deficit}</p>
                    <p className="text-[10px] text-brand-parchment/35">units below target</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInsight title="No restock pressure right now" description="Products will show up here when inventory falls to or below the reorder threshold." />
          )}
        </InsightPanel>

        <InsightPanel title="Recent High-Value Orders" subtitle="Largest paid checkouts">
          {analytics.recentHighValueOrders.length ? (
            <div className="space-y-4">
              {analytics.recentHighValueOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <p className="text-sm text-brand-parchment font-black">{order.customerName || order.customerEmail}</p>
                    <p className="text-[11px] text-brand-parchment/35">
                      {order.orderDate ? order.orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand-gold font-black">{currency(order.totalAmount ?? 0)}</p>
                    <p className="text-[10px] text-brand-parchment/35">{(order.items || []).length} line items</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInsight title="No paid orders yet" description="High-value order highlights require completed orders with totals." />
          )}
        </InsightPanel>

        <InsightPanel title="Frequently Bought Together" subtitle="Most common product combinations">
          {analytics.commonProductCombos.length ? (
            <div className="space-y-4">
              {analytics.commonProductCombos.map((combo) => (
                <div key={combo.key} className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <p className="text-sm text-brand-parchment font-black">{combo.label}</p>
                  <div className="text-right">
                    <p className="text-brand-gold font-black">{combo.count}</p>
                    <p className="text-[10px] text-brand-parchment/35">orders together</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInsight title="Combination data is still building" description="This insight appears once orders contain multiple distinct products." />
          )}
        </InsightPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <InsightPanel title="Bundle Performance" subtitle="Shown only when bundle orders exist">
          {analytics.bundlePerformance.length ? (
            <HorizontalBars
              data={analytics.bundlePerformance.map((bundle) => ({
                label: bundle.label,
                value: bundle.revenue,
                secondaryValue: `${bundle.orders} bundle orders`,
              }))}
              formatter={currency}
              emptyTitle="No bundle sales yet"
              emptyDescription="Bundle analytics require orders containing products named or tagged as bundles."
            />
          ) : (
            <EmptyInsight
              title="Bundle performance is not available yet"
              description="Current analytics only count actual bundle products in order items. If bundles are assembled ad hoc from individual salts, we would need explicit bundle identifiers to report on them."
            />
          )}
        </InsightPanel>

        <InsightPanel title="Data Coverage Notes" subtitle="What this dashboard is using">
          <div className="space-y-5 text-sm text-brand-parchment/55 leading-relaxed">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
              <span>Orders with shipping state</span>
              <span className="text-brand-gold font-black">{analytics.dataCoverage.ordersWithShippingState}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
              <span>Customers identifiable by email</span>
              <span className="text-brand-gold font-black">{analytics.dataCoverage.ordersWithCustomerEmail}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
              <span>Bundle orders currently detectable</span>
              <span className="text-brand-gold font-black">{analytics.dataCoverage.bundleOrders}</span>
            </div>
            <p>
              Missing on purpose: traffic, conversion rate, ad attribution, and abandoned cart reporting. Those require analytics tooling that is not currently implemented in the repo.
            </p>
            <p>
              If order volume grows, the next backend improvement would be cached daily aggregates so this dashboard does not need to recompute everything client-side from raw orders.
            </p>
          </div>
        </InsightPanel>
      </div>
    </div>
  );
};
