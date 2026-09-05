export async function subscribeToNewsletter(email: string, source: string) {
  const response = await fetch('/api/subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      source,
      consent: true,
      requestId: crypto.randomUUID(),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Unable to subscribe right now.');
  }

  return data;
}
