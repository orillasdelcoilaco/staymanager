# Plan de acción — npm audit → 0 (Render / backend)

## 1. Problema / contexto

El build en **Render** ejecuta `npm install` y reporta decenas de vulnerabilidades (ej. **28** en log de producción). Objetivo del producto: **0** hallazgos en `npm audit` para el árbol instalado en deploy, sin romper runtime ni contratos.

**Restricciones:** cambios mínimos; probar `npm start` / smoke tras subir dependencias; respetar modo dual y multi-tenant (este ítem no toca queries, solo dependencias).

## 2. Opciones consideradas

| Opción | Pros | Contras | ¿Descartada? |
|--------|------|---------|--------------|
| `npm audit fix` (sin force) | Seguro, semver | No resuelve todo | No |
| `npm audit fix --force` | Más CVEs cerrados | Rompe semver / APIs | Solo tras revisar diff |
| Sustituir paquetes sin fix (`xlsx`, cadenas profundas) | Puede llegar a 0 | Esfuerzo y regresión | Parcial |
| Ignorar audit con `.npmrc` / overrides sin análisis | Rápido | No cumple objetivo “0” real | Sí para cierre falso |

## 3. Enfoque elegido

1. Confirmar en **Render → Service → Root Directory** si el install es `backend/` o raíz.
2. En esa carpeta: `npm audit`, luego `npm audit fix` (sin `--force`).
3. Re-auditar; para cada cadena restante: actualizar dependencia directa o **overrides** acotados en `package.json` si el equipo los acepta.
4. **`xlsx`:** si sigue sin fix, evaluar alternativa (p. ej. lectura CSV-only, otra lib) o decisión documentada de riesgo residual (no cuenta como “0” hasta sustituir o eliminar el finding).

## 4. Pasos de implementación

- [ ] Confirmar directorio de build en Render y lockfile usado en CI/prod.
- [ ] Guardar salida `npm audit --json` (backend y raíz si aplica) en bitácora del tema o adjunto interno del equipo.
- [ ] Aplicar `npm audit fix`; commit lockfile; ejecutar `npm run test:ci` / smoke mínimo desde raíz según `package.json`.
- [ ] Tratar hallazgos restantes por severidad (crítico/high primero): `protobufjs`, `express`/`path-to-regexp`, `firebase-admin` cadena, `node-ical`/`axios`, `express-rate-limit`, etc.
- [ ] Revisión final: `npm audit` → 0; si queda `xlsx` u otro sin fix, cerrar sub-tarea “sustitución” o rebajar objetivo con sign-off.

## 5. Bitácora de planificación (pre-código y durante)

- **2026-05-06** — Tema creado en tablero (`SM-npm-audit-zero`). Log Render: 28 vulnerabilidades. Local `backend/`: ~30; raíz repo: 2. Objetivo acordado con usuario: llevar audit a **0**; documentado riesgo `xlsx` sin fix en npm audit.
- **2026-05-06** — Ejecutado `npm audit fix` (sin `--force`) en raíz y `backend/`. Raíz: **0** vulnerabilidades. `backend/`: bajó a **13** (8 low, 2 moderate, 3 high); persisten cadenas que solo `audit fix --force` tocaría (`@anthropic-ai/sdk`, `firebase-admin`/teeny-request, `node-ical`/`axios`, `fast-xml-parser`) y **`xlsx`** (sin fix en npm). `npm run test:ci` OK tras los bumps automáticos.
- **2026-05-06** — **Fase 2 cerrada.** Eliminada dependencia **`@anthropic-ai/sdk`** (no había `require` en el código). **`xlsx`** reemplazado por **`exceljs`** (`.xlsx`) y **`csv-parse/sync`** (`.csv`) en `sincronizacionService.js`. Actualizados **`firebase-admin`** → 13.x, **`node-ical`** → 0.26.1, **`fast-xml-parser`** → 5.7.x. Últimos 8 hallazgos *low* en cadena `teeny-request` → `http-proxy-agent@5` → `@tootallnate/once@2`: resueltos con **`overrides`: `"http-proxy-agent": "^7.0.2"`** en `backend/package.json` (npm audit **0**). `npm run test:ci` + carga de módulos OK.
