export type ReviewSummary = { count: number; average: number | null };
const cache = new Map<string, { at: number; value: ReviewSummary }>();
const requests = new Map<string, Promise<ReviewSummary>>();
const pending = new Map<string, { resolve: (value: ReviewSummary) => void; reject: (error: Error) => void }>();
let timer: ReturnType<typeof setTimeout> | undefined;
async function flush() {
  timer = undefined;
  const batch = Array.from(pending.entries()); pending.clear();
  for (let offset = 0; offset < batch.length; offset += 30) {
    const chunk = batch.slice(offset, offset + 30);
    try {
      const response = await fetch(`/api/reviews/summaries?ids=${encodeURIComponent(JSON.stringify(chunk.map(([id]) => id)))}`);
      if (!response.ok) throw new Error('Review summaries unavailable');
      const data = await response.json();
      for (const [id, handlers] of chunk) {
        const value = data.summaries?.[id];
        if (!value || !Number.isInteger(value.count) || value.count < 0 || (value.count > 0 && !(value.average >= 1 && value.average <= 5))) handlers.reject(new Error('Invalid review summary'));
        else { cache.set(id, { at: Date.now(), value }); handlers.resolve(value); }
      }
    } catch (error) {
      chunk.forEach(([, handlers]) => handlers.reject(error instanceof Error ? error : new Error('Reviews unavailable')));
    } finally { chunk.forEach(([id]) => requests.delete(id)); }
  }
}
// Coalesce cards rendered together; share requests for repeated products.
export function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const cached = cache.get(productId);
  if (cached && Date.now() - cached.at < 30000) return Promise.resolve(cached.value);
  const existing = requests.get(productId); if (existing) return existing;
  const promise = new Promise<ReviewSummary>((resolve, reject) => pending.set(productId, { resolve, reject }));
  requests.set(productId, promise);
  if (!timer) timer = setTimeout(flush, 0);
  return promise;
}
