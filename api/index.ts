import { createApp } from '../server.js';

const appPromise = createApp();

export default async function handler(request: any, response: any) {
  const forwardedPath = Array.isArray(request.query?.path)
    ? request.query.path.join('/')
    : String(request.query?.path || '');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query || {})) {
    if (key === 'path') continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item != null) query.append(key, String(item));
    }
  }
  request.url = `/api/${forwardedPath}${query.size ? `?${query.toString()}` : ''}`;
  const app = await appPromise;
  return app(request, response);
}
