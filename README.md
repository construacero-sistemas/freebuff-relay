# Freebuff Relay — Guia de Despliegue y Configuracion

Este relay transparente elimina por completo las firmas de Cloudflare Workers (`CF-Worker`, `CF-Ray`, etc.) para evitar bloqueos y permitir el acceso completo a los modelos de Freebuff desde Venezuela.

---

## Contenido del Directorio

- `relay.ts`: Codigo fuente del relay en TypeScript (Bun).
- `relay-windows-x64.exe`: Binario compilado listo para Windows.
- `relay-linux-x64`: Binario compilado para servidores Linux x86_64.
- `relay-linux-arm64`: Binario compilado para servidores Linux ARM64.
- `Dockerfile`: Imagen Docker ultra-ligera multi-stage.
- `render.yaml`: Blueprint para despliegue en Render.com.
- `fly.toml`: Configuracion para despliegue en Fly.io.
- `freebuff-relay.service`: Unidad systemd para VPS Linux.
- `install-relay.sh`: Instalador desatendido para VPS Linux.
- `pinger.ts`: Monitor keep-alive para evitar el apagado de instancias gratuitas.
- `patch-desktop.js`: Herramienta para actualizar `orchestrator.js` y verificar sintaxis.

---

## OPCION 1: Despliegue Gratuito en Render (Recomendada — Sin Tarjeta de Credito)

Render ofrece servicios web gratuitos sin requerir tarjeta de credito y es accesible desde Venezuela.

### Pasos:
1. Crea un repositorio en GitHub (publico o privado), por ejemplo `freebuff-relay`.
2. Sube los archivos `relay.ts` y `Dockerfile` al repositorio.
3. Inicia sesion en [render.com](https://render.com).
4. Haz clic en **New +** -> **Web Service**.
5. Conecta tu repositorio de GitHub `freebuff-relay`.
6. En la configuracion:
   - **Name**: `freebuff-relay` (o el nombre que elijas).
   - **Language**: `Docker`.
   - **Instance Type**: `Free`.
   - **Health Check Path**: `/healthz`.
7. Haz clic en **Create Web Service**.
8. Una vez desplegado, Render te dara una URL publica HTTPS, por ejemplo:
   `https://freebuff-relay-xxxx.onrender.com`

### Evitar el Spindown (15 min de inactividad)
El plan gratuito de Render se duerme tras 15 minutos sin trafico. Para mantenerlo 100% despierto las 24 horas:
- **Opcion A (Recomendada - Servicio externo gratuito)**:
  Registrate gratis en [cron-job.org](https://cron-job.org) o [uptimerobot.com](https://uptimerobot.com) y crea un monitor cada **5 minutos** a:
  `https://tu-relay.onrender.com/healthz`
- **Opcion B (Local)**:
  Ejecuta en segundo plano:
  ```powershell
  bun run pinger.ts https://tu-relay.onrender.com
  ```

---

## OPCION 2: Prueba Local en Windows (Inmediata)

Puedes probar el relay directamente en tu equipo sin subir nada a la nube:

1. Ejecuta el binario local o con Bun:
   ```powershell
   bun run relay.ts
   # o bien:
   .\relay-windows-x64.exe
   ```
2. En otra terminal, prueba el healthcheck:
   ```powershell
   curl.exe http://127.0.0.1:8787/healthz
   ```
   Respuesta esperada: `{"ok":true,"uptime":...}`

---

## OPCION 3: Despliegue en VPS Linux (Cualquier proveedor)

Si cuentas con un VPS Linux (Ubuntu/Debian):
1. Copia los archivos `relay-linux-x64` (o `arm64`), `freebuff-relay.service` e `install-relay.sh` al servidor:
   ```bash
   scp relay-linux-x64 freebuff-relay.service install-relay.sh user@tu-servidor:/tmp/
   ```
2. En el servidor, ejecuta:
   ```bash
   cd /tmp
   sudo bash install-relay.sh
   ```

---

## Como Reapuntar Freebuff Desktop

Cuando tengas la URL publica de tu relay (o para probar localmente con `http://127.0.0.1:8787`):

### 1. Aplicar en Staging (@codebufffreebuff-staging):
```powershell
node patch-desktop.js https://tu-relay.onrender.com staging
# o local:
node patch-desktop.js http://127.0.0.1:8787 staging
```

### 2. Aplicar en Produccion (@codebufffreebuff-desktop):
```powershell
node patch-desktop.js https://tu-relay.onrender.com prod
```

El script actualiza automaticamente las 3 constantes (`getWebsiteUrl`, `PROD_API_HOST`, `API_HOST`) y ejecuta `node --check` para certificar que el archivo no tiene errores de sintaxis.

---

## Checklist de Verificacion Operativa

1. **Health Check**:
   ```powershell
   curl.exe -v https://tu-relay.onrender.com/healthz
   ```
   Verificar que responde `200 OK` y que la cabecera de respuesta no contiene `cf-worker`.

2. **Apertura de Freebuff**:
   - Abrir Freebuff Desktop.
   - El selector de modelos debe mostrar el catalogo completo sin banner de restriccion regional (`gpt-5.6-luna`, `minimax-m3`, `kimi-k3-eco`, `deepseek-v4-pro`, `claude-fable-5`, etc.).

3. **Prueba de Chat**:
   - Enviar un mensaje corto en un thread de prueba.
   - Verificar en los logs (`%APPDATA%\Freebuff\logs\orchestrator-stderr.log`) que las peticiones dan `status 200` y no `session_limit_reached`.

4. **Estado de Sesion**:
   - Verificar `accessTier: "full"` y `status: "none"`.
