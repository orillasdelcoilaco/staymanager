# Evaluación: rutas Rezerva consumibles desde navegador (sitio estático)
Fecha: 2026-10-23 ~21:45 (hora de Chile, UTC-3). Solo lectura. No se creó ninguna reserva ni se envió secreto.
Pruebas: curl con Origin https://orillasdelcoilaco.github.io, https://orillasdelcoilaco.cl, el propio subdominio rezerva y sin Origin.

| Ruta | Método | Parámetros | CORS / origen actual | ¿Usable desde frontend? |
|---|---|---|---|---|
| https://orillasdelcoilaco.rezerva.cl/api/public/propiedades | GET | opcional: filtros/fechas | JSON, `Access-Control-Allow-Origin: *`, preflight 204 OK | **SÍ** |
| /propiedad/{id}/calendario-ocupacion (ej. id `cabana-1`) | GET | `from`, `to` (YYYY-MM-DD) obligatorios | JSON 200 con cualquier origen, pero **sin header ACAO** y OPTIONS → 404 HTML | **NO** (el navegador bloquea la lectura; falta CORS) |
| /propiedad/{id}/calcular-precio | POST JSON | `fechaLlegada`, `fechaSalida`, `personas` | Sin Origin o con origen rezerva → 200 JSON; con origin github.io o .cl → **403 ORIGIN_FORBIDDEN**; OPTIONS 404 | **NO** (lista blanca de origen + falta CORS) |
| /crear-reserva-publica | POST JSON | cuerpo de reserva (con `{}` → 500 "Falta el alojamiento.") | Igual que precio: 403 ORIGIN_FORBIDDEN para github.io y .cl; OPTIONS 404 | **NO** |
| https://gestor-reservas.onrender.com/api/puente-sodc/reservas | POST + `X-Puente-Secreto` | — | OPTIONS desde .cl → 200, ACAO `https://orillasdelcoilaco.cl`, permite `x-puente-secreto`; desde github.io → 500 | Técnicamente sí desde .cl, pero **NUNCA** debe usarse desde el navegador (expondría el secreto) |

Id real obtenido del catálogo: `cabana-1` (7 propiedades).
No se verificaron cookies/CSRF: ninguna respuesta puso `Set-Cookie`; el bloqueo es por cabecera Origin (sin Origin funciona → el servidor PHP actual pasa).

## Qué falta en Rezerva (rezerva.cl)
1. Agregar `https://orillasdelcoilaco.cl` (y `https://www.` y, si se usa, `https://orillasdelcoilaco.github.io`) a la lista de orígenes permitidos de calcular-precio y crear-reserva-publica (hoy dan ORIGIN_FORBIDDEN).
2. Responder CORS (ACAO + manejo de OPTIONS) en `/propiedad/*` y `/crear-reserva-publica`; hoy OPTIONS da 404.
3. Puente: el secreto no puede ir en el navegador. Opciones: que la reserva vaya directo por /crear-reserva-publica (Rezerva ya hace correos y plazos) o un proxy servidor (Render/Cloudflare Worker) que agregue el secreto.
4. Protección anti-abuso en endpoints públicos de escritura: captcha (Turnstile/hCaptcha), rate limit, validación — hoy dependían de estar detrás del PHP.
5. Partes que hoy leen HTML (oferta grupos `/?fechaLlegada…`, número wa.me) deberían tener endpoint JSON.

## Recomendación
Catálogo ya es usable. Para el resto, pedir a Cursor Rezerva: lista blanca de origen + CORS para el dominio final (orillasdelcoilaco.cl, no github.io), captcha+rate limit en crear-reserva-publica, y eliminar el uso del puente desde el cliente (o pasarlo por un proxy servidor). Hacer la prueba con github.io solo en staging.

Notas: la búsqueda de código en orillasdelcoilaco/sodc y orillasdelcoilaco/staymanager no devolvió resultados (índice de búsqueda de GitHub vacío/incompleto); parámetros deducidos de las respuestas reales. staymanager puede estar desactualizado frente a pmeza-rezerva/rezerva (no accesible).
