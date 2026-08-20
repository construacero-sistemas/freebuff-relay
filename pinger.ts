// pinger.ts - Keep-alive monitor for free cloud hosts (Render / Koyeb)
// Prevents spindown by sending a lightweight GET /healthz every 5 minutes

const TARGET_URL = process.env.RELAY_URL || process.argv[2];
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '300000', 10); // 5 minutes default

if (!TARGET_URL) {
  console.error('Uso: bun run pinger.ts https://tu-relay.onrender.com');
  process.exit(1);
}

const healthUrl = TARGET_URL.replace(/\/+$/, '') + '/healthz';
console.log(`[Pinger] Iniciando keep-alive hacia: ${healthUrl}`);
console.log(`[Pinger] Intervalo: ${INTERVAL_MS / 1000} segundos`);

async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(healthUrl, {
      headers: { 'User-Agent': 'Freebuff-KeepAlive-Pinger/1.0' },
    });
    const ms = Date.now() - start;
    const body = await res.text();
    console.log(`[${new Date().toLocaleTimeString()}] Ping ${res.status} OK (${ms}ms) -> ${body}`);
  } catch (err: any) {
    console.error(`[${new Date().toLocaleTimeString()}] Ping ERROR:`, err.message || err);
  }
}

// First ping immediately, then setInterval
ping();
setInterval(ping, INTERVAL_MS);
