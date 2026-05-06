# SM-npm-audit-zero — Vulnerabilidades npm en despliegue (Render)

## Objetivo

Reducir **`npm audit`** a **0** vulnerabilidades reportadas en el árbol que instala **Render** en build (hoy el servicio corre `node index.js`; en dashboard suele usarse **Root Directory = `backend`** — confirmar ahí).

## Referencia de baseline (2026-05-06)

- Log Render (commit desplegado): **28** (8 low, 9 moderate, 10 high, 1 critical) tras `npm install`.
- Local `backend/`: **`npm audit`** → **30** (8 low, 10 moderate, 11 high, 1 critical) — pequeña diferencia por versión de npm/lock.

## Alcance

- `backend/package.json` + `backend/package-lock.json` (principal).
- Raíz `package.json` / `package-lock.json` si el servicio de Render apunta al repo root (auditar aparte).

## Riesgo conocido

- **`xlsx` (SheetJS):** el auditor suele marcar **high** y puede indicar **no fix available**; cerrar a 0 puede exigir **sustituir** la librería o acotar uso (solo lectura en rutas confiables) y documentar excepción — ver plan de acción.

## Documentos

- Plan: [`plan-accion-npm-audit-zero.md`](plan-accion-npm-audit-zero.md)

## Estado

- **Listo (2026-05-06)** — `backend/npm audit`: **0** vulnerabilidades. Sustitución `xlsx` por **exceljs** + **csv-parse** (`sincronizacionService.js`); dependencias actualizadas y `overrides` documentados en `plan-accion-npm-audit-zero.md`. Commit `backend/package.json` + `backend/package-lock.json` (+ raíz si cambió) y deploy Render.
