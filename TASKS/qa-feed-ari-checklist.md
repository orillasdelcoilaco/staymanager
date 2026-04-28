# QA Checklist — Feed ARI (`/feed-ari.xml`)

Objetivo: validar que el feed ARI público por tenant funcione con parámetros, token y forma XML mínima.

## 1) Prerrequisitos

- Servidor levantado.
- Empresa tenant resoluble por host/subdominio.
- (Opcional) `websiteSettings.integrations.ariFeedToken` configurado para validar control de acceso.

## 2) Casos funcionales

- [ ] `GET /feed-ari.xml` responde `200` y `Content-Type` XML.
- [ ] `GET /feed-ari.xml?mode=website` responde `200`.
- [ ] `GET /feed-ari.xml?mode=google_hotels` responde `200`.
- [ ] `GET /feed-ari.xml?days=14` responde `200`.
- [ ] `GET /feed-ari.xml?days=365` responde `200`.
- [ ] `GET /feed-ari.xml?days=1` aplica clamp interno (no falla).
- [ ] `GET /feed-ari.xml?days=999` aplica clamp interno (no falla).

## 3) Seguridad por token (si está configurado)

- [ ] Sin `token` retorna `401`.
- [ ] Con `token` inválido retorna `401`.
- [ ] Con `token` correcto retorna `200`.

## 4) Forma XML mínima

- [ ] Tiene cabecera XML (`<?xml version="1.0" ...?>`).
- [ ] Tiene `<Transaction ...>` y `</Transaction>`.
- [ ] Tiene al menos un `<Result ...>` (aunque vacío).
- [ ] Si hay propiedades listadas: aparecen `<Property ...>` y `<RoomData ...>`.
- [ ] Cuando hay inventario/tarifas para período: aparecen `<Inventory ...>` y/o `<Rate ...>`.

## 5) Ayuda pública de parámetros

- [ ] `GET /widget-reserva-ayuda.json` incluye `ariFeed.endpoint`, modos (`website`, `google_hotels`), rango `days` y ejemplos.

## 6) Automatizado mínimo local

- [ ] `node backend/scripts/test-ari-feed-xml-sanity.js`
- [ ] `node backend/scripts/test-ari-feed-request.js`
- [ ] `npm run test:ci`

## Resultado esperado

Checklist completo en verde sin regresiones en `test:ci`.

