import test from 'node:test';
import assert from 'node:assert/strict';
import { getReviewSummary } from './reviewSummaryService.js';

test('rating summaries batch cards, deduplicate, cache and distinguish errors from zero reviews', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async input => {
    calls++;
    const ids = JSON.parse(new URL(String(input), 'http://localhost').searchParams.get('ids')!);
    return new Response(JSON.stringify({ summaries: Object.fromEntries(ids.map((id: string) => [id, id === 'rated' ? { count: 3, average: 4.6666667 } : { count: 0, average: null }])) }));
  };
  try {
    const [a, b, c] = await Promise.all([getReviewSummary('rated'), getReviewSummary('empty'), getReviewSummary('rated')]);
    assert.equal(calls, 1); assert.deepEqual(a, c); assert.equal(a.average, 4.6666667);
    assert.deepEqual(b, { count: 0, average: null });
    await getReviewSummary('rated'); assert.equal(calls, 1);
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(getReviewSummary('failure'));
    globalThis.fetch = async () => new Response(JSON.stringify({ summaries: { failure: { count: 0, average: null } } }));
    assert.deepEqual(await getReviewSummary('failure'), { count: 0, average: null });
  } finally { globalThis.fetch = original; }
});
