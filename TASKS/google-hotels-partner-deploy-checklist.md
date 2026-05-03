# Checklist despliegue — Google Hotels Connectivity Partner (plataforma)

**Referencia de ingeniería:** `TASKS/venta-ia.md` §7, §7.9–§7.11. **Código:** agregador **`backend/services/googleHotelsGlobalService.js`** (re-export en `googleHotelsPartner/googleHotelsPartnerFeeds.js`), **`backend/routes/googleHotelsPartner.routes.js`**, `feedXmlWellformed.js`, montaje en `backend/index.js`.

Usar en **staging** primero; **TTL DNS bajo** durante certificación Google (§7.11 fila 3).

### Orden recomendado (primera vez)

1. **Código ya en `main` desplegado** en Render (o la rama que uséis en prod).
2. **Variables §2** en el servicio Render (mínimo `GOOGLE_PARTNER_FEED_AUTH_TOKEN` largo; **sin** `ALLOW_PARTNER_FEED_WITHOUT_AUTH` en prod).
3. **Sin DNS aún:** añadir **`GOOGLE_PARTNER_EXTRA_HOSTS`** con el hostname público del servicio (p. ej. `tu-app.onrender.com`) para poder llamar feeds **antes** de tener `feeds.suitemanagers.com`.
4. **Smoke HTTP §3** (PowerShell: `curl.exe -s -o NUL -w "%{http_code}" "https://HOST/feeds/google/properties.xml?auth=TOKEN"`).
5. **DNS §1** cuando toque certificación final: `feeds.<dominio>` y/o `api.<dominio>` → mismo backend.
6. **Quitar o reducir `EXTRA_HOSTS`** si ya no hace falta exponer `onrender.com` a Google.
7. **Google Hotel Center §4** con URLs definitivas.
8. **Catálogo humano:** `https://suitemanagers.com/google-hotels` (marketplace apex).

**Rutas feed (siempre bajo el mismo host permitido):**

- `GET /feeds/google/properties.xml?auth=<TOKEN>`
- `GET /feeds/google/ari.xml?auth=<TOKEN>`

---

## 1. DNS (apex / subdominios dedicados)

- [ ] Crear **CNAME** (o A si aplica) para los hosts que usará Google según tu contrato operativo:
  - [ ] `api.<PLATFORM_DOMAIN>` → servicio Render (o balanceador).
  - [ ] `feeds.<PLATFORM_DOMAIN>` → mismo destino que sirve el backend (mismo servicio que `api.` si comparten app).
- [ ] Propagar y verificar con `nslookup` / panel DNS.
- [ ] Tras certificación estable, **subir TTL** a valor operativo habitual.

`PLATFORM_DOMAIN` por defecto en código marketplace: `suitemanagers.com` (`backend/services/marketplaceService.js`).

---

## 2. Variables de entorno (Render / producción)

Copiar desde `backend/.env.example` y generar valores nuevos en producción (no reutilizar tokens de desarrollo).

| Variable | Notas |
|----------|--------|
| `GOOGLE_PARTNER_FEED_AUTH_TOKEN` | Token largo (mín. 16 caracteres); query `?auth=` en feeds globales. |
| `GOOGLE_PARTNER_EXTRA_HOSTS` | Opcional: hosts adicionales (p. ej. `*.onrender.com` de staging), coma-separados. |
| `GOOGLE_PARTNER_ARI_DAYS` | Opcional; rango de días ARI (clamp en código). |
| `GOOGLE_PARTNER_RATE_PLAN_ID` | Opcional; default `sm_direct_lowest`. |
| `GOOGLE_PARTNER_REQUIRE_PLACE_ID` | `1` para exigir **`googleHotelData.placeId`** en el agregador global (además de lat/lng); default en código relajado — ver `googleHotelsGlobalService.js`. |
| `GOOGLE_HOTELS_XSD_PATH` | Opcional: ruta absoluta a XSD en disco; requiere **`xmllint` en el PATH** del contenedor. |
| `GOOGLE_PARTNER_FEED_SELFTEST_BASE_URL` | Opcional: URL base pública para el selftest del panel (si el host no es `feeds.<PLATFORM_DOMAIN>`; p. ej. `https://tu-app.onrender.com`). |
| — | **No** definir `ALLOW_PARTNER_FEED_WITHOUT_AUTH` en producción. |

---

## 3. Validación técnica previa a Google

- [ ] `GET https://feeds.<dominio>/feeds/google/properties.xml?auth=<TOKEN>` — HTTP 200, XML bien formado.
- [ ] `GET https://feeds.<dominio>/feeds/google/ari.xml?auth=<TOKEN>` — HTTP 200.
- [ ] Desde repo con `DATABASE_URL`: `node backend/scripts/test-google-partner-feeds-smoke.js` → OK.
- [ ] **HTTP público (sin clone de BD):** `GH_PARTNER_FEED_BASE_URL` + `GH_PARTNER_FEED_AUTH_TOKEN` → `node backend/scripts/smoke-google-partner-feeds-http.js` → OK (mismo token que `GOOGLE_PARTNER_FEED_AUTH_TOKEN` en el servidor).
- [ ] **Alternativa / complemento (panel):** con sesión de administrador, **Operaciones → Canales IA → Google Hotels** → bloque *Feeds globales Google (vista operación plataforma)* → **Probar feeds HTTP** (el servidor usa `GOOGLE_PARTNER_FEED_AUTH_TOKEN` y, si hace falta, `GOOGLE_PARTNER_FEED_SELFTEST_BASE_URL` o `GH_PARTNER_FEED_BASE_URL` — ver `backend/.env.example`).
- [ ] Catálogo humano: `https://<apex marketplace>/google-hotels` (y `?lang=en` si aplica).
- [ ] Si usáis XSD: instalar paquete que provea `xmllint` en la imagen de deploy o validar en CI aparte.

---

## 4. Trámite externo (Google)

- [ ] Hotel Center / Connectivity: URLs finales de feeds, Partner Key según proceso Google.
- [ ] Registrar estado por empresa en checklist onboarding (`TASKS/checklist-onboarding-google-hotel-center.md`) donde aplique.

---

## 5. Git / deploy (acuerdo de equipo)

- [ ] **Push a `main` / deploy Render:** según sesión integradora acordada (`TASKS/leer-primero.md` §5.1).
- [ ] Tras deploy: repetir §3 contra URLs públicas reales.

---

*Última actualización: 2026-05-03 — panel Canales IA (selftest HTTP) + env `GOOGLE_PARTNER_FEED_SELFTEST_BASE_URL`; historial 2026-05-02.*
