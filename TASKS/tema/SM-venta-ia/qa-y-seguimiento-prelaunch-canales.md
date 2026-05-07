# QA pre-lanzamiento + seguimiento Canales / Google / OpenAPI

**Propósito:** una sola lista para **(1)** validar menú + Canales IA tras los cambios recientes y **(2)** continuar con **operativización Google** y **revisión OpenAPI** según **`TASKS/tema/SM-venta-ia/venta-ia.md` §4**.

**Relación con otros docs**

| Documento | Uso |
|-----------|-----|
| **`TASKS/tema/SM-spa-menu/plan-reorganizacion-menu-spa.md`** | Taxonomía menú (Inventario / Sitio público); no repetir aquí. |
| **`TASKS/tema/SM-venta-ia/venta-ia.md` §2.6 y §4** | Detalle Canales IA y checklist operativo unificado. |
| **`TASKS/tema/SM-ghc-onboarding/checklist-onboarding-google-hotel-center.md`** | Onboarding Google Hotel Center por tenant. |

**Al cerrar una sesión:** marcar checkboxes hechos y anotar fecha/nombre en **§ Estado al pie**.

---

## Parte 1 — QA manual panel SPA (hacer primero)

Entorno: backend arriba (`npm run dev` en `backend/` o equivalente), SPA cargando panel.

### 1.1 Menú lateral

- [ ] **Dashboard** abre `/` sin error.
- [ ] **Flujo de Trabajo:** mismas entradas que antes (Gestión Diaria … CRM); nadie falta ni cambió de ruta.
- [ ] **Operaciones:** orden = Reservas → Clientes → Tarifas → Reseñas → **Canales de venta** → Canales IA → iCal → Bloqueos.
- [ ] Pasar el ratón por **título de categoría** (Operaciones, Inventario, Sitio público, Configuración): aparece tooltip (`title`).
- [ ] Pasar el ratón por **Canales de venta** y **Canales IA**: tooltips distinguen PMS vs conectores externos.
- [ ] **Inventario:** Activos … Normas (sin Contenido/Config Web mezclados).
- [ ] **Sitio público:** Contenido Web (`/website-alojamientos`) y Configuración Web (`/website-general`).
- [ ] **Configuración:** al menos Empresa y una entrada más abren vista correcta.

### 1.2 Canales IA (`/canales-ia`)

- [ ] Carga sin error; texto de las tres capas (Inventario / Sitio público / Canales IA) visible.
- [ ] Pestaña **Google Hotels:** se ven tokens ARI + Google content, botón guardar tokens; semáforo carga o muestra error comprensible si API falla.
- [ ] Bloque **Checklist Google — §0 automático** (arriba en Google Hotels): el recuadro muestra empresa, `empresaId`, host derivado, responsable (email de sesión), fecha y bloque PowerShell/script §9; **Copiar todo** pega el texto al portapapeles.
- [ ] Si el tenant **no** tiene subdominio ni dominio custom configurados: aparece aviso **Sin URL pública derivada** (banner advertencia) y el botón **Ir a Configuración Web** del banner navega a `/website-general`. Con host configurado, ese banner no debe mostrarse.
- [ ] Guardar tokens (opcional): **Guardar tokens de feeds** → sin error o mensaje claro.
- [ ] Tabla alojamientos: si hay propiedades, **Guardar** en una fila persiste (recargar página y verificar).
- [ ] Pestaña **ChatGPT:** línea **GET /api/public/version** muestra versión/fecha o mensaje de fallo de red/servidor (no pantalla en blanco).
- [ ] Botones **Ir a Configuración Web** navegan a `/website-general`.
- [ ] Pestaña **Gemini:** texto + CTA Config Web.

### 1.3 Configuración Web tras puente

- [ ] Desde **Sitio público → Configuración Web**, **Guardar** el formulario unificado **no borra** tokens de integración si no están en pantalla (comportamiento documentado en `venta-ia.md` §2.6).

### 1.4 Opcional — línea de comandos (mismo host que el SPA)

Con el backend en marcha:

```bash
# Desarrollo típico (backend `PORT` por defecto 3001 en backend/index.js)
curl.exe -sS "http://localhost:3001/api/public/version"
```

En PowerShell, usar **`curl.exe`** (el alias `curl` apunta a `Invoke-WebRequest`). Para un tenant en producción, sustituir por la URL base pública (sin barra final).

Respuesta JSON esperada: `version`, `timestamp` (y en código actual puede incluir `deployed_at`).

---

## Parte 2 — Seguimiento producto (después de Parte 1 OK)

Orden sugerido: **Google (feeds + Hotel Center)** → **OpenAPI / flujo agente**. Detalle extendido en **`TASKS/tema/SM-venta-ia/venta-ia.md` §4**.  
**Secuencia B (multi-agente, 2026-05):** **`TASKS/tema/SM-ghc-onboarding/google-hotels-partner-deploy-checklist.md`** (*Secuencia B*) — deploy prod + DNS `api.`/`feeds.` + env partner → smoke global → onboarding Hotel Center **por tenant** (checklist onboarding §1–§8) → **§9** script (`npm run smoke:google-hotels-tenant`). El runbook de abajo cubre sobre todo **tenant + §9**; el checklist partner enlaza el bloque **B1–B2** antes.

### Runbook — un solo tenant (Google feeds + script §9)

Sigue los pasos **en orden**. El script **`verify-google-hotels-feed-checklist.js`** llama por HTTP al **mismo host que ven los huéspedes**: debe ser la **URL pública base del sitio SSR** del tenant (HTTPS en Render u otro), **sin barra final**.  
No uses `http://localhost` salvo que tengas el mismo tenant resuelto en ese host (muchas veces el resolver espera subdominio real; si falla, usa la URL pública).

**Paso 1 — Hoja de control**
Abre **`TASKS/tema/SM-ghc-onboarding/checklist-onboarding-google-hotel-center.md`** y completa **§0**, o genera el bloque desde **Operaciones → Canales IA** → **Google Hotels** → **Checklist Google — §0 automático** (copiar al portapapeles) y pégalo en tu nota o en el propio checklist.

**Paso 2 — Panel (Canales IA)**  
En **`/canales-ia`** (menú **Operaciones → Canales IA**):

1. Si quieres proteger el feed: guarda **token feed contenido Google Hotels** y anótalo para el Paso 4 (`GH_FEED_TOKEN`).  
2. Revisa **semáforo** Google Hotels (actualizar si hace falta).  
3. En la tabla por alojamiento: al menos un caso de negocio con **Hotel Center ID** + **Publicar en Web/Google** acorde al checklist **§1** (alojamiento listado + `hotelId` no vacío).

**Paso 3 — Checklist §1–§2 a mano (navegador)**  
En el host público del tenant:

- Abre `https://<tu-host>/feed-google-hotels-content.xml` (y si hay token, prueba sin `?token=`, con token malo y con token bueno según **`checklist-onboarding-google-hotel-center.md` §2**).

**Paso 4 — Script automatizado §9 (desde la raíz del repo)**  

PowerShell (Windows):

```powershell
cd "d:\pmeza\Desarrollos Render\staymanager"

# Sin token en el tenant (feed 200 sin query):
$env:GH_FEED_BASE_URL = "https://TU-SUBDOMINIO.rezerva.cl"
Remove-Item Env:GH_FEED_TOKEN -ErrorAction SilentlyContinue
node backend/scripts/verify-google-hotels-feed-checklist.js

# Con token configurado en panel (mismo valor que pegaste en Canales IA):
$env:GH_FEED_BASE_URL = "https://TU-SUBDOMINIO.rezerva.cl"
$env:GH_FEED_TOKEN = "el-valor-exacto-del-panel"
node backend/scripts/verify-google-hotels-feed-checklist.js
```

- Salida **exit 0** y líneas `OK ...` → cumple forma **§2–§3** del checklist (ayuda JSON + feed XML).  
- **Exit 1** → leer `FAIL ...`; corregir tokens, host o listados en panel y repetir.

**Paso 5 — Lo que el script no hace**  
Completar en **`checklist-onboarding-google-hotel-center.md`** las secciones **§4–§8** (negocio, registro en Hotel Center, operación, evidencias). Ahí entra el trabajo **en la consola de Google**, no en este repo.

**Paso 6 — Registro interno**  
Anotar en la tabla **Estado** (al pie de este archivo) si el tenant quedó **operativo** / **bloqueado** y el motivo.

---

### 2.A Google Hotel Center y feeds (checklist resumido)

- [ ] Runbook anterior completado para **un** tenant piloto.
- [ ] **`TASKS/tema/SM-ghc-onboarding/checklist-onboarding-google-hotel-center.md`:** §0–§8 según negocio; §9 verificado con script cuando aplique URL pública.
- [ ] Opcional: probar `https://<tenant>/feed-ari.xml` en navegador si usáis ARI con Google.
- [ ] Registrar por empresa: **operativo** / **bloqueado** + siguiente acción.

### 2.B OpenAPI / ChatGPT

- [ ] Tras cualquier cambio en rutas públicas IA: diff **`backend/openapi/openapi-chatgpt.yaml`** (y gemini si aplica) vs rutas reales (`backend/routes/publicRoutes.js`, controladores).
- [ ] Prueba manual flujo agente en **staging** (o local con claves): búsqueda → disponibilidad → cotizar → reserva (según política).
- [ ] Anotar versión OpenAPI entregada al conector (**1.4.7** u otra) al publicar.

---

## Estado (rellenar por sesión)

| Fecha | Quién | Parte 1 QA | Parte 2.A Google | Parte 2.B OpenAPI | Notas |
|-------|-------|------------|------------------|-------------------|--------|
|       |       | ☐ / ☑      | ☐ / ☑            | ☐ / ☑             |        |

---

*Última actualización: 2026-05-01 — QA §1.2: checklist §0 automático + banner sin host; runbook **un tenant** (Google): panel + script §9 + PowerShell; checklist §4–§8 manual.*
