import type { ContactMessage } from '@/src/components/admin/MessagesView';
import type { Order } from '@/src/components/admin/DashboardView';
import type { Subscriber } from '@/src/components/admin/SubscribersView';
import type { Product } from '@/src/services/productService';

type DateRangeMode = 'day' | 'week' | 'month';

type MetricPoint = {
  label: string;
  value: number;
};

type ProductMetric = {
  key: string;
  label: string;
  units: number;
  revenue: number;
};

type MixMetric = {
  key: string;
  label: string;
  value: number;
};

type RegionMetric = {
  region: string;
  orders: number;
  revenue: number;
};

type CustomerMetric = {
  label: string;
  newCustomers: number;
  returningCustomers: number;
};

type ComboMetric = {
  key: string;
  label: string;
  count: number;
};

type BundleMetric = {
  label: string;
  orders: number;
  revenue: number;
};

type HighValueOrder = Order & {
  orderDate: Date | null;
};

type RestockWatchItem = Product & {
  deficit: number;
};

export interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalUnitsSold: number;
    repeatCustomerCount: number;
    repeatCustomerRate: number;
    lowStockProductCount: number;
  };
  trends: Record<DateRangeMode, {
    revenue: MetricPoint[];
    orders: MetricPoint[];
    customers: CustomerMetric[];
    subscribers: MetricPoint[];
    inquiries: MetricPoint[];
  }>;
  topProductsByUnits: ProductMetric[];
  topProductsByRevenue: ProductMetric[];
  salesMixByCategory: MixMetric[];
  salesMixByHeatLevel: MixMetric[];
  ordersByRegion: RegionMetric[];
  lowStockWatchlist: RestockWatchItem[];
  recentHighValueOrders: HighValueOrder[];
  commonProductCombos: ComboMetric[];
  bundlePerformance: BundleMetric[];
  dataCoverage: {
    ordersWithShippingState: number;
    ordersWithCustomerEmail: number;
    bundleOrders: number;
  };
}

export interface AnalyticsFilters {
  dateWindow: '30d' | '90d' | '365d' | 'all';
  productFilter: string;
}

type OrderItem = {
  productId?: string;
  name?: string;
  price?: number;
  quantity?: number;
  heatLevel?: number;
};

const HEAT_LEVEL_LABELS = ['No Heat', 'Mild', 'Medium', 'Bold', 'Hot', 'Inferno'];

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const WEEK_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
      return new Date((value as { seconds: number }).seconds * 1000);
    }
  }

  return null;
}

function getOrderDate(order: Order): Date | null {
  return toDate(order.paidAt ?? order.createdAt);
}

function groupKey(date: Date, mode: DateRangeMode) {
  if (mode === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  if (mode === 'week') {
    const start = new Date(date);
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function formatGroupLabel(key: string, mode: DateRangeMode) {
  if (mode === 'month') {
    const [year, month] = key.split('-').map(Number);
    return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
  }

  const date = new Date(key);
  if (mode === 'week') {
    return `Week of ${WEEK_FORMATTER.format(date)}`;
  }

  return DAY_FORMATTER.format(date);
}

function sortMetricMap(map: Map<string, number>) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export function buildAnalyticsData({
  orders,
  products,
  subscribers,
  messages,
  filters,
}: {
  orders: Order[];
  products: Product[];
  subscribers: Subscriber[];
  messages: ContactMessage[];
  filters: AnalyticsFilters;
}): AnalyticsData {
  const now = Date.now();
  const dayCount =
    filters.dateWindow === '30d'
      ? 30
      : filters.dateWindow === '90d'
        ? 90
        : filters.dateWindow === '365d'
          ? 365
          : null;
  const windowStart = dayCount ? new Date(now - dayCount * 24 * 60 * 60 * 1000) : null;
  const productsById = new Map(products.map((product) => [product.id, product]));
  const selectedProductId = filters.productFilter.startsWith('product:') ? filters.productFilter.replace('product:', '') : null;
  const selectedCategory = filters.productFilter.startsWith('category:') ? filters.productFilter.replace('category:', '') : null;

  const productMatchesFilter = (product?: Product) => {
    if (!product) return !selectedProductId && !selectedCategory;
    if (selectedProductId) return product.id === selectedProductId;
    if (selectedCategory) return product.category === selectedCategory;
    return true;
  };

  const orderMatchesFilter = (order: Order) => {
    if (!selectedProductId && !selectedCategory) return true;
    return (order.items || []).some((item: OrderItem) => {
      const product = item.productId ? productsById.get(item.productId) : undefined;
      if (selectedProductId) {
        return item.productId === selectedProductId;
      }
      return productMatchesFilter(product);
    });
  };

  const activeOrders = orders.filter((order) => {
    const orderDate = getOrderDate(order);
    const withinWindow = !windowStart || (orderDate ? orderDate >= windowStart : false);
    return ((order.paymentStatus || '').toLowerCase() === 'paid' || (order.totalAmount ?? 0) > 0) && withinWindow && orderMatchesFilter(order);
  });
  const filteredSubscribers = subscribers.filter((subscriber) => {
    const date = toDate(subscriber.createdAt || subscriber.subscribedAt);
    return !windowStart || (date ? date >= windowStart : false);
  });
  const filteredMessages = messages.filter((message) => {
    const date = toDate(message.createdAt);
    return !windowStart || (date ? date >= windowStart : false);
  });
  const filteredProducts = products.filter((product) => productMatchesFilter(product));

  const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
  const totalUnitsSold = activeOrders.reduce(
    (sum, order) => sum + (order.items || []).reduce((itemSum, item: OrderItem) => itemSum + (item.quantity ?? 0), 0),
    0
  );

  const ordersByCustomer = new Map<string, Order[]>();
  activeOrders.forEach((order) => {
    const email = (order.customerEmail || '').trim().toLowerCase();
    if (!email) return;
    const existing = ordersByCustomer.get(email) || [];
    existing.push(order);
    ordersByCustomer.set(email, existing);
  });

  const repeatCustomerCount = Array.from(ordersByCustomer.values()).filter((customerOrders) => customerOrders.length > 1).length;
  const repeatCustomerRate = ordersByCustomer.size ? repeatCustomerCount / ordersByCustomer.size : 0;

  const productTotals = new Map<string, ProductMetric>();
  const categoryTotals = new Map<string, number>();
  const heatLevelTotals = new Map<string, number>();
  const stateTotals = new Map<string, RegionMetric>();
  const comboTotals = new Map<string, number>();
  const bundleTotals = new Map<string, BundleMetric>();
  let ordersWithShippingState = 0;

  activeOrders.forEach((order) => {
    const orderTotal = order.totalAmount ?? 0;
    const shippingState = order.shippingAddress?.state?.trim();
    if (shippingState) {
      ordersWithShippingState += 1;
      const stateMetric = stateTotals.get(shippingState) || { region: shippingState, orders: 0, revenue: 0 };
      stateMetric.orders += 1;
      stateMetric.revenue += orderTotal;
      stateTotals.set(shippingState, stateMetric);
    }

    const comboCandidates = (order.items || [])
      .map((item: OrderItem) => item.productId || item.name)
      .filter(Boolean) as string[];

    const uniqueComboCandidates = Array.from(new Set(comboCandidates)).sort();
    for (let index = 0; index < uniqueComboCandidates.length; index += 1) {
      for (let inner = index + 1; inner < uniqueComboCandidates.length; inner += 1) {
        const comboKey = `${uniqueComboCandidates[index]}__${uniqueComboCandidates[inner]}`;
        comboTotals.set(comboKey, (comboTotals.get(comboKey) || 0) + 1);
      }
    }

    (order.items || []).forEach((item: OrderItem) => {
      const quantity = item.quantity ?? 0;
      const unitPrice = item.price ?? 0;
      const revenue = quantity * unitPrice;
      const productId = item.productId || item.name || 'unknown-product';
      const product = item.productId ? productsById.get(item.productId) : undefined;
      const label = item.name || product?.name || productId;

      const metric = productTotals.get(productId) || { key: productId, label, units: 0, revenue: 0 };
      metric.units += quantity;
      metric.revenue += revenue;
      productTotals.set(productId, metric);

      const categoryLabel = product?.category || 'Uncategorized';
      categoryTotals.set(categoryLabel, (categoryTotals.get(categoryLabel) || 0) + revenue);

      const heatIndex = Math.max(0, Math.min(5, product?.heatLevel ?? item.heatLevel ?? 0));
      const heatLabel = HEAT_LEVEL_LABELS[heatIndex] || `Heat ${heatIndex}`;
      heatLevelTotals.set(heatLabel, (heatLevelTotals.get(heatLabel) || 0) + revenue);

      const lowerLabel = label.toLowerCase();
      const isBundle = lowerLabel.includes('bundle') || lowerLabel.includes('gift set') || lowerLabel.includes('collection');
      if (isBundle) {
        const bundleMetric = bundleTotals.get(label) || { label, orders: 0, revenue: 0 };
        bundleMetric.orders += 1;
        bundleMetric.revenue += revenue;
        bundleTotals.set(label, bundleMetric);
      }
    });
  });

  const sortedOrdersForCustomerTracking = [...activeOrders].sort((a, b) => {
    const left = getOrderDate(a)?.getTime() || 0;
    const right = getOrderDate(b)?.getTime() || 0;
    return left - right;
  });

  const buildTrendSeries = (mode: DateRangeMode) => {
    const revenueMap = new Map<string, number>();
    const ordersMap = new Map<string, number>();
    const newCustomerMap = new Map<string, number>();
    const returningCustomerMap = new Map<string, number>();
    const subscriberMap = new Map<string, number>();
    const inquiryMap = new Map<string, number>();
    const seenCustomers = new Set<string>();

    sortedOrdersForCustomerTracking.forEach((order) => {
      const orderDate = getOrderDate(order);
      if (!orderDate) return;

      const key = groupKey(orderDate, mode);
      revenueMap.set(key, (revenueMap.get(key) || 0) + (order.totalAmount ?? 0));
      ordersMap.set(key, (ordersMap.get(key) || 0) + 1);

      const email = (order.customerEmail || '').trim().toLowerCase();
      if (!email) return;

      if (seenCustomers.has(email)) {
        returningCustomerMap.set(key, (returningCustomerMap.get(key) || 0) + 1);
      } else {
        seenCustomers.add(email);
        newCustomerMap.set(key, (newCustomerMap.get(key) || 0) + 1);
      }
    });

    filteredSubscribers.forEach((subscriber) => {
      const date = toDate(subscriber.createdAt || subscriber.subscribedAt);
      if (!date) return;
      const key = groupKey(date, mode);
      subscriberMap.set(key, (subscriberMap.get(key) || 0) + 1);
    });

    filteredMessages.forEach((message) => {
      const date = toDate(message.createdAt);
      if (!date) return;
      const key = groupKey(date, mode);
      inquiryMap.set(key, (inquiryMap.get(key) || 0) + 1);
    });

    const allKeys = new Set<string>([
      ...revenueMap.keys(),
      ...ordersMap.keys(),
      ...newCustomerMap.keys(),
      ...returningCustomerMap.keys(),
      ...subscriberMap.keys(),
      ...inquiryMap.keys(),
    ]);

    const sortedKeys = Array.from(allKeys).sort();

    return {
      revenue: sortedKeys.map((key) => ({ label: formatGroupLabel(key, mode), value: revenueMap.get(key) || 0 })),
      orders: sortedKeys.map((key) => ({ label: formatGroupLabel(key, mode), value: ordersMap.get(key) || 0 })),
      customers: sortedKeys.map((key) => ({
        label: formatGroupLabel(key, mode),
        newCustomers: newCustomerMap.get(key) || 0,
        returningCustomers: returningCustomerMap.get(key) || 0,
      })),
      subscribers: sortedKeys.map((key) => ({ label: formatGroupLabel(key, mode), value: subscriberMap.get(key) || 0 })),
      inquiries: sortedKeys.map((key) => ({ label: formatGroupLabel(key, mode), value: inquiryMap.get(key) || 0 })),
    };
  };

  const lowStockWatchlist = [...filteredProducts]
    .filter((product) => product.currentInventory <= (product.reorderThreshold || 10))
    .map((product) => ({
      ...product,
      deficit: Math.max((product.reorderThreshold || 10) - product.currentInventory, 0),
    }))
    .sort((a, b) => a.currentInventory - b.currentInventory);

  const recentHighValueOrders = [...activeOrders]
    .map((order) => ({ ...order, orderDate: getOrderDate(order) }))
    .sort((a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0) || ((b.orderDate?.getTime() || 0) - (a.orderDate?.getTime() || 0)))
    .slice(0, 8);

  const topProducts = Array.from(productTotals.values()).sort((a, b) => b.units - a.units);
  const topProductsByRevenue = [...topProducts].sort((a, b) => b.revenue - a.revenue);

  const commonProductCombos = Array.from(comboTotals.entries())
    .map(([key, count]) => {
      const [left, right] = key.split('__');
      const leftProduct = productsById.get(left)?.name || left;
      const rightProduct = productsById.get(right)?.name || right;
      return {
        key,
        label: `${leftProduct} + ${rightProduct}`,
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    summary: {
      totalRevenue,
      totalOrders: activeOrders.length,
      averageOrderValue: activeOrders.length ? totalRevenue / activeOrders.length : 0,
      totalUnitsSold,
      repeatCustomerCount,
      repeatCustomerRate,
      lowStockProductCount: lowStockWatchlist.length,
    },
    trends: {
      day: buildTrendSeries('day'),
      week: buildTrendSeries('week'),
      month: buildTrendSeries('month'),
    },
    topProductsByUnits: topProducts.slice(0, 8),
    topProductsByRevenue: topProductsByRevenue.slice(0, 8),
    salesMixByCategory: sortMetricMap(categoryTotals).slice(0, 8).map((item) => ({ key: item.label, ...item })),
    salesMixByHeatLevel: sortMetricMap(heatLevelTotals).slice(0, 6).map((item) => ({ key: item.label, ...item })),
    ordersByRegion: Array.from(stateTotals.values()).sort((a, b) => b.orders - a.orders).slice(0, 8),
    lowStockWatchlist,
    recentHighValueOrders,
    commonProductCombos,
    bundlePerformance: Array.from(bundleTotals.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    dataCoverage: {
      ordersWithShippingState,
      ordersWithCustomerEmail: Array.from(ordersByCustomer.keys()).length,
      bundleOrders: Array.from(bundleTotals.values()).reduce((sum, metric) => sum + metric.orders, 0),
    },
  };
}
