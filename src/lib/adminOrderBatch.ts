export type BatchOrderLike = { id: string; paymentStatus?: string; fulfillmentStatus?: string };

export function canBatchPack(order: BatchOrderLike) {
  return ['paid', 'partially_refunded'].includes(order.paymentStatus || '')
    && ['pending', 'requires_attention'].includes(order.fulfillmentStatus || 'pending');
}

export function summarizeOrderBatch(
  attempted: BatchOrderLike[],
  settled: PromiseSettledResult<unknown>[],
  describeError: (error: unknown) => string,
) {
  return settled.reduce((summary, result, index) => {
    const order = attempted[index];
    if (!order) return summary;
    if (result.status === 'fulfilled') summary.succeeded.push(order.id);
    else summary.failed.push({ id: order.id, message: describeError(result.reason) });
    return summary;
  }, { succeeded: [] as string[], failed: [] as Array<{ id: string; message: string }> });
}

