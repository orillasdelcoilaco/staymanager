# Oleada 2 — Mapeo archivo → `tema/<ID>/`

Fecha: 2026-05-05. Objetivo: agrupar planes, guías, informes y operación fuera del backlog canónico.

## Tabla de mapeo

| Archivo (antes en `TASKS/`) | ID carpeta | Ruta nueva |
|-----------------------------|------------|------------|
| `plan-reorganizacion-menu-spa.md` | `SM-spa-menu` | `tema/SM-spa-menu/plan-reorganizacion-menu-spa.md` |
| `plan-ssr-arquitectura-dos-capas.md` | `SM-ssr-sitio-publico` | `tema/SM-ssr-sitio-publico/…` |
| `plan-accion-ssr-empresa.md` | `SM-ssr-sitio-publico` | `tema/SM-ssr-sitio-publico/…` |
| `plan-contenido-web-wizard.md` | `SM-ssr-sitio-publico` | `tema/SM-ssr-sitio-publico/…` |
| `plan-accion-fotos-cabana10.md` | `SM-fotos-galeria` | `tema/SM-fotos-galeria/…` |
| `guia-prueba-img-001.md` | `SM-fotos-galeria` | `tema/SM-fotos-galeria/…` |
| `verificacion-flujo-ia-fotos.md` | `SM-fotos-galeria` | `tema/SM-fotos-galeria/…` |
| `solucion-unificada-fotos.md` | `SM-fotos-galeria` | `tema/SM-fotos-galeria/…` |
| `resumen-correccion-banos.md` | `SM-fotos-galeria` | `tema/SM-fotos-galeria/…` |
| `plan-accion-problemas.md` | `SM-dev-historial` | `tema/SM-dev-historial/…` |
| `plan-accion-clientes-sin-reserva.md` | `SM-clientes-crm` | `tema/SM-clientes-crm/…` |
| `plan-gestion-propiedades.md` | `SM-propiedades` | `tema/SM-propiedades/…` |
| `acuerdo-arquitectura-ia.md` | `SM-ia-arquitectura` | `tema/SM-ia-arquitectura/…` |
| `plan-gemma4-omnipresente.md` | `SM-ia-arquitectura` | `tema/SM-ia-arquitectura/…` |
| `audit-report.md` | `SM-auditoria-calidad` | `tema/SM-auditoria-calidad/…` |
| `complexity-report.md` | `SM-auditoria-calidad` | `tema/SM-auditoria-calidad/…` |
| `plan-auditoria-frontend.md` | `SM-auditoria-calidad` | `tema/SM-auditoria-calidad/…` |
| `performance-optimization-report.md` | `SM-auditoria-calidad` | `tema/SM-auditoria-calidad/…` |
| `solo-ui.md` | `SM-auditoria-calidad` | `tema/SM-auditoria-calidad/…` |
| `plan-video-onboarding.md` | `SM-onboarding-ux` | `tema/SM-onboarding-ux/…` |
| `migration-plan-postgres.md` | `SM-migracion-postgres` | `tema/SM-migracion-postgres/…` |
| `alertas-creditos.md` | `SM-operacion-agentes` | `tema/SM-operacion-agentes/…` |
| `pending.md` | `SM-operacion-agentes` | `tema/SM-operacion-agentes/pending.md` |
| `completed.md` | `SM-operacion-agentes` | `tema/SM-operacion-agentes/completed.md` |
| `definition-of-done.md` | `SM-operacion-agentes` | `tema/SM-operacion-agentes/…` |

## Permanece en la raíz de `TASKS/`

`backlog-producto-pendientes.md`, `venta-ia.md`, `coordinacion-cursor-claude-ia-venta.md`, `coordinacion-cursor-paralelo.md` (multi-agente Cursor), `tablero.md`.

## Workflows GitHub

**Hecho:** `notify-tasks.yml` y `notify-completed.yml` usan `TASKS/tema/SM-operacion-agentes/pending.md` y `…/completed.md` en `paths:` y en el cuerpo del mensaje.

## Scripts que escriben archivos

`scripts/tooling/audit-ui.js`, `scripts/tooling/audit-complexity.js`, `scripts/tooling/monitor-creditos.js`, `scripts/tooling/config-creditos.json` → salida bajo `tema/SM-auditoria-calidad/` o `tema/SM-operacion-agentes/` según corresponda.
