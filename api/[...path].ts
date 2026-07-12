import { createApp } from '../server.js';

const appPromise = createApp();

export default async function handler(request: any, response: any) {
  const app = await appPromise;
  return app(request, response);
}
