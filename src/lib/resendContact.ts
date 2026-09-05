// Resend may report a missing contact as a 404 or a validation error.
// Never treat credential, rate-limit, or transport failures as successful deletion.
export function isMissingResendContact(error: { name?: string; message?: string; statusCode?: number | null } | null | undefined) {
  if (!error) return false;
  if (error.name === 'not_found' || error.statusCode === 404) return true;
  return error.name === 'validation_error' && /\bcontact\b.{0,100}\b(not found|does not exist)\b/i.test(error.message || '');
}
