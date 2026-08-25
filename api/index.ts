export const config = {
  runtime: 'edge',
};

const UPSTREAM = 'https://www.codebuff.com';
const upstreamHost = 'www.codebuff.com';

const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'true-client-ip',
  'x-real-ip',
  'cdn-loop',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'x-vercel-id',
  'x-vercel-ip-country',
  'x-vercel-ip-country-region',
  'x-vercel-ip-city',
  'x-vercel-ip-latitude',
  'x-vercel-ip-longitude',
  'x-vercel-ip-timezone',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'server',
  'nel',
  'report-to',
  'alt-svc',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // Health checks
  if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/api/healthz' || url.pathname === '/')) {
    return new Response(JSON.stringify({ status: 'ok', ok: true, platform: 'vercel-edge', timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 
        'content-type': 'application/json',
        'cache-control': 'no-store, no-cache, must-revalidate',
      },
    });
  }

  const targetUrl = new URL(url.pathname + url.search, UPSTREAM);
  const headers = new Headers();
  headers.set('host', upstreamHost);

  for (const [k, v] of req.headers.entries()) {
    const lower = k.toLowerCase();
    if (!STRIP_REQUEST_HEADERS.has(lower) && !lower.startsWith('cf-') && !lower.startsWith('x-forwarded-') && !lower.startsWith('x-vercel-')) {
      headers.set(k, v);
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? req.body : undefined;

  try {
    const upstreamResp = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    const respHeaders = new Headers();
    for (const [k, v] of upstreamResp.headers.entries()) {
      const lower = k.toLowerCase();
      if (!STRIP_RESPONSE_HEADERS.has(lower) && !lower.startsWith('cf-')) {
        respHeaders.set(k, v);
      }
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'relay_upstream_error',
        message: err?.message || 'Failed to reach upstream server',
      }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
}
