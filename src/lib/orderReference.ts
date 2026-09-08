const ORDER_REFERENCE_PREFIX = 'BP-';
const ORDER_REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ORDER_REFERENCE_CODE_LENGTH = 6;
const ORDER_REFERENCE_PATTERN = /^BP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export function isOrderReference(value: unknown): value is string {
  return typeof value === 'string' && ORDER_REFERENCE_PATTERN.test(value.trim().toUpperCase());
}

export function createOrderReference(randomValues: ArrayLike<number>) {
  if (randomValues.length < ORDER_REFERENCE_CODE_LENGTH) {
    throw new Error(`Order references require at least ${ORDER_REFERENCE_CODE_LENGTH} random values.`);
  }

  let code = '';
  for (let index = 0; index < ORDER_REFERENCE_CODE_LENGTH; index += 1) {
    code += ORDER_REFERENCE_ALPHABET[Number(randomValues[index]) % ORDER_REFERENCE_ALPHABET.length];
  }
  return `${ORDER_REFERENCE_PREFIX}${code}`;
}

function legacyCode(orderId: string) {
  let hash = 2166136261;
  for (const character of orderId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  let code = '';
  let state = hash || 0x9e3779b9;
  for (let index = 0; index < ORDER_REFERENCE_CODE_LENGTH; index += 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822519) >>> 0;
    code += ORDER_REFERENCE_ALPHABET[state % ORDER_REFERENCE_ALPHABET.length];
  }
  return code;
}

export function orderReference(orderId: string, storedReference?: unknown) {
  if (isOrderReference(storedReference)) return storedReference.trim().toUpperCase();
  return `${ORDER_REFERENCE_PREFIX}${legacyCode(String(orderId || 'legacy-order'))}`;
}
