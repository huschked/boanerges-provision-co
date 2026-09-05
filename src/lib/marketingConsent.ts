export function mayActivateMarketing(existing: { status?: string; unsubscribedAt?: unknown }, confirmed = false) {
  return confirmed || (existing.status !== 'unsubscribed' && !existing.unsubscribedAt);
}

export function validPreferenceToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
}

export function preferenceAction(token: { action: string; version: number; usedAt?: unknown; expiresAtMs?: number }, current: { status?: string; preferenceVersion?: number }, consent: boolean, now = Date.now()) {
  if (token.expiresAtMs && token.expiresAtMs < now) throw new Error('This link is expired. Please sign up again.');
  if (token.action === 'unsubscribe') return 'unsubscribe';
  if (token.action !== 'subscribe') throw new Error('Invalid preference action.');
  if (token.usedAt) return current.status === 'active' ? 'subscribe' : 'unsubscribe';
  if (!consent || Number(current.preferenceVersion || 0) !== token.version) throw new Error('This confirmation is no longer current. Please sign up again.');
  return 'subscribe';
}
