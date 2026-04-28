# Checklist operativo — Onboarding Google Hotel Center (por empresa)

Objetivo: habilitar y validar el feed de contenido Google Hotels por tenant usando `GET /feed-google-hotels-content.xml`.

## 0) Datos de control (completar)

- Empresa:
- `empresaId`:
- Host tenant validado (subdominio/dominio):
- Responsable:
- Fecha:

## 1) Prerrequisitos de producto

- [ ] La empresa resuelve correctamente por tenant (SSR activo en su host).
- [ ] Existe al menos 1 alojamiento con `googleHotelData.isListed = true`.
- [ ] Cada alojamiento listado tiene `googleHotelData.hotelId` no vacío y estable.
- [ ] (Recomendado) token configurado en `websiteSettings.integrations.googleHotelsContentToken`.

## 2) URL y acceso del feed

- [ ] URL base documentada:
  - `https://<tenant>/feed-google-hotels-content.xml`
- [ ] Si hay token:
  - [ ] sin `?token=` retorna `401`
  - [ ] con token inválido retorna `401`
  - [ ] con token válido retorna `200`
- [ ] Si no hay token:
  - [ ] el feed responde `200` sin query params.

## 3) Validación técnica de respuesta

- [ ] `Content-Type` es XML (`application/xml` o equivalente).
- [ ] XML bien formado (sin errores de parseo).
- [ ] Tiene `<?xml version="1.0" encoding="UTF-8"?>`.
- [ ] Tiene `<Transaction ...>` y `</Transaction>`.
- [ ] Tiene `<Result>`.
- [ ] Si hay alojamientos listados, aparecen nodos `<Property id="...">`.

## 4) Validación de datos de negocio

- [ ] Cada `Property.id` coincide con `googleHotelData.hotelId` esperado por negocio.
- [ ] El `<Name>` coincide con el alojamiento publicado.
- [ ] Si aplica dirección, campos de `<Address>` coherentes (`addr1`, `city`, `country`).
- [ ] Sin alojamientos listados, el feed sigue respondiendo XML válido (resultado vacío).

## 5) Validación de endpoint de ayuda pública

- [ ] `GET /widget-reserva-ayuda.json` incluye bloque `googleHotelsContentFeed`.
- [ ] El `endpoint` del bloque coincide con el host tenant actual.
- [ ] La documentación de token está presente cuando corresponde.

## 6) Carga en Google Hotel Center

- [ ] URL del feed registrada en Hotel Center.
- [ ] Validación inicial en Hotel Center sin errores bloqueantes.
- [ ] Mapeo de propiedades confirmado (`Property.id` ↔ ID en Hotel Center).
- [ ] Primer fetch exitoso registrado por el panel de Google.

## 7) Operación continua

- [ ] Cambio de `hotelId` bloqueado o controlado (no mutar IDs publicados sin plan).
- [ ] Al publicar/despublicar alojamientos, se revalida feed.
- [ ] Rotación de token (si aplica) con ventana controlada.
- [ ] Incidencias documentadas (fecha, error, resolución).

## 8) Evidencia mínima (adjuntar links o capturas)

- [ ] URL probada en navegador / curl.
- [ ] Respuesta `200` y `401` (si token activo).
- [ ] Captura de validación Hotel Center.
- [ ] Registro interno de aprobación de operación.

## 9) Verificación automatizada (HTTP + forma XML)

Desde la raíz del repo (requiere URL pública del tenant; opcional token si el feed lo exige). En PowerShell use `$env:GH_FEED_BASE_URL="https://..."` en lugar de `set`.

```bash
# Feed público sin token en el tenant
set GH_FEED_BASE_URL=https://TU-SUBDOMINIO.dominio.com
node backend/scripts/verify-google-hotels-feed-checklist.js

# Tenant con `googleHotelsContentToken` configurado
set GH_FEED_BASE_URL=https://...
set GH_FEED_TOKEN=el-mismo-valor-que-en-panel
node backend/scripts/verify-google-hotels-feed-checklist.js
```

El script comprueba `widget-reserva-ayuda.json` (bloque `googleHotelsContentFeed`), códigos `401`/`200` según token, `Content-Type` XML y presencia de `Transaction` / `Result`. Completar a mano las secciones **4–8** (negocio, Hotel Center, operación).

## Resultado esperado

Empresa habilitada en Google Hotel Center con feed de contenido funcional, control de acceso validado y mapeo de propiedades confirmado.

