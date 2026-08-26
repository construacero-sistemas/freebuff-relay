// relay.ts - Transparent, host-agnostic Relay for Freebuff
// Strips Cloudflare Worker signatures (CF-Worker, CF-Ray, etc.) and edge headers.

const PORT = parseInt(process.env.PORT || Bun.env.PORT || '8789', 10);
const UPSTREAM = (process.env.UPSTREAM || Bun.env.UPSTREAM || 'https://www.codebuff.com').replace(/\/+$/, '');
const EGRESS_PROXY = process.env.EGRESS_PROXY || Bun.env.EGRESS_PROXY || '';
const upstreamHost = new URL(UPSTREAM).host;

// Headers that must NOT be forwarded upstream
const STRIP_REQUEST_HEADERS_EXACT = new Set([
  'host',
  'true-client-ip',
  'x-real-ip',
  'cdn-loop',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
]);

const STRIP_RESPONSE_HEADERS_EXACT = new Set([
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

function shouldStripRequestHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (STRIP_REQUEST_HEADERS_EXACT.has(lower)) return true;
  if (lower.startsWith('cf-')) return true;
  if (lower.startsWith('x-forwarded-')) return true;
  return false;
}

function shouldStripResponseHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (STRIP_RESPONSE_HEADERS_EXACT.has(lower)) return true;
  if (lower.startsWith('cf-')) return true;
  return false;
}

console.log(`[Relay] Freebuff Transparent Relay starting...`);
console.log(`[Relay] Target Upstream: ${UPSTREAM} (Host: ${upstreamHost})`);
console.log(`[Relay] Egress Proxy: ${EGRESS_PROXY || 'Direct'}`);
console.log(`[Relay] Port: ${PORT}`);

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const startTime = Date.now();
    const reqUrl = new URL(req.url);

    // Immediate Health & Reachability checks (GET & HEAD)
    if ((req.method === 'GET' || req.method === 'HEAD') && 
        (reqUrl.pathname === '/healthz' || reqUrl.pathname === '/api/healthz' || reqUrl.pathname === '/')) {
      return new Response(JSON.stringify({ status: 'ok', ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // Construct target upstream URL
    const targetUrl = new URL(reqUrl.pathname + reqUrl.search, UPSTREAM);

    // Filter and sanitize request headers
    const upstreamHeaders = new Headers();
    upstreamHeaders.set('host', upstreamHost);

    for (const [key, value] of req.headers.entries()) {
      if (!shouldStripRequestHeader(key)) {
        upstreamHeaders.set(key, value);
      }
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody ? req.body : undefined;

    try {
      // Forward request to upstream with transparent body streaming
      const upstreamResp = await fetch(targetUrl.toString(), {
        method: req.method,
        headers: upstreamHeaders,
        body,
        // @ts-ignore - duplex is required for fetch with stream body
        duplex: hasBody ? 'half' : undefined,
        redirect: 'manual',
        proxy: EGRESS_PROXY || undefined,
      });

      // Filter response headers
      const responseHeaders = new Headers();
      for (const [key, value] of upstreamResp.headers.entries()) {
        if (!shouldStripResponseHeader(key)) {
          responseHeaders.set(key, value);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[Relay] ${req.method} ${reqUrl.pathname} -> ${upstreamResp.status} (${duration}ms)`);

      // Stream response body directly to client
      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[Relay Error] ${req.method} ${targetUrl.pathname} failed after ${duration}ms:`, err?.message || err);
      return new Response(
        JSON.stringify({
          error: 'relay_upstream_error',
          message: err?.message || 'Failed to reach upstream server',
        }),
        {
          status: 502,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }
  },
});
