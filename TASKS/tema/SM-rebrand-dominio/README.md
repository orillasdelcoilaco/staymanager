---
tema: SM-rebrand-dominio
título: Rebrand dominio (suitemanagers.com → rezerva.cl) + limpieza Firebase
estado: En curso (Cursor)
última nota: 2026-05-07 — `publicAiHttpController.js` (ex suitemanager API) + MCP `rezerva-mcp-server`; **pendiente:** ops DNS Fase 1/3, Fase 4 PG — ver `pendientes-y-registro.md`
---

# SM-rebrand-dominio — Rebrand de Dominio y Limpieza de Infraestructura

## Contexto

El dominio `suitemanagers.com` tiene un problema de confusión en buscadores con `suitemanager.com`
(sitio de venta de propiedades, sin relación). La confusión afecta SEO y posicionamiento de marca.

**Dominio candidato:** `rezerva.cl` (disponible; `rezerva.com` no disponible aunque no está a la venta).

## Documentos del tema

| Archivo | Contenido |
|---------|-----------|
| `plan-accion-rebrand.md` | Plan maestro: fases 0–5, Firebase, GitHub, DoD |
| **`pendientes-y-registro.md`** | **Qué no se hizo / quedó pendiente / intencional** — leer antes de dar por cerrado el tema |

## Pendientes (resumen)

- **Infra:** Fase 1 DNS/Render y Fase 3 repo/carpeta/webhook — detalle en `pendientes-y-registro.md` §1.
- **Docs secundarios:** varios `TASKS/tema/*` históricos con `suitemanagers.com` — listado en `pendientes-y-registro.md` §3 (no bloquean entrada `LEER-PRIMERO`).
- **Código:** compatibilidad dominios viejos en `config.routes.js`; handlers IA pública en `backend/services/publicAiHttpController.js`; test obsoleto `verify-subdomain-logic.js` — §2 en `pendientes-y-registro.md`.

## Estado

Ver `TASKS/tablero.md` fila `SM-rebrand-dominio`.
