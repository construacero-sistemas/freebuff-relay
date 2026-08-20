const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetUrl = process.argv[2];
const mode = process.argv[3] || 'staging'; // 'staging' or 'prod'

if (!targetUrl) {
  console.error('Uso: node patch-desktop.js <URL_DEL_RELAY> [staging|prod]');
  console.error('Ejemplo: node patch-desktop.js https://mi-relay.onrender.com staging');
  console.error('Ejemplo: node patch-desktop.js http://127.0.0.1:8787 prod');
  process.exit(1);
}

const normalizedUrl = targetUrl.replace(/\/+$/, '');

const stagingPath = 'C:\\Users\\luigg\\Desktop\\DOCUMENTOS\\@codebufffreebuff-staging\\resources\\orchestrator\\orchestrator.js';
const prodPath = 'C:\\Users\\luigg\\AppData\\Local\\Programs\\@codebufffreebuff-desktop\\resources\\orchestrator\\orchestrator.js';

const targetFile = mode === 'prod' ? prodPath : stagingPath;

if (!fs.existsSync(targetFile)) {
  console.error(`[Error] No se encontro el archivo: ${targetFile}`);
  process.exit(1);
}

console.log(`[Patch] Modificando: ${targetFile}`);
console.log(`[Patch] Nueva URL de Relay: ${normalizedUrl}`);

let content = fs.readFileSync(targetFile, 'utf8');

// Backup
const backupPath = targetFile + '.bak';
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`[Patch] Copia de seguridad guardada en: ${backupPath}`);
}

// 1. Reemplazar getWebsiteUrl()
// Acepta tanto la version original como versiones previamente parcheadas
const websiteUrlRegex = /function getWebsiteUrl\(\)\s*\{[\s\S]*?return[\s\S]*?;\s*\}/;
content = content.replace(websiteUrlRegex, `function getWebsiteUrl() {\n  return "${normalizedUrl}";\n}`);

// 2. Reemplazar PROD_API_HOST
const prodApiRegex = /var PROD_API_HOST\s*=\s*["'][^"']+["'];/;
content = content.replace(prodApiRegex, `var PROD_API_HOST = "${normalizedUrl}";`);

// 3. Reemplazar API_HOST
const apiHostRegex = /var API_HOST\s*=\s*canonicalizeHost\(["'][^"']+["']\)/;
content = content.replace(apiHostRegex, `var API_HOST = canonicalizeHost("${normalizedUrl}")`);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('[Patch] Reemplazos completados.');

// Validar sintaxis con node --check
try {
  console.log('[Patch] Validando sintaxis con node --check...');
  execSync(`node --check "${targetFile}"`, { stdio: 'inherit' });
  console.log('[Patch] Validacion exitosa: orchestrator.js es valido.');
} catch (e) {
  console.error('[Patch Error] Error de sintaxis tras aplicar el parche.');
  process.exit(1);
}
