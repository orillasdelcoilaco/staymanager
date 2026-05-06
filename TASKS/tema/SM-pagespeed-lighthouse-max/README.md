# SM-pagespeed-lighthouse-max

## Objetivo

Acercar **todas** las URLs SSR tenant (`website.*`) y **suitemanagers.com** (marketplace / páginas públicas plataforma) al **máximo realista** en Lighthouse / PageSpeed Insights (rendimiento, accesibilidad, buenas prácticas, SEO), sin sacrificar multi-tenant ni seguridad.

## Prioridad

**Máxima** — ver `TASKS/tablero.md`.

## Lecturas canónicas

- **`audit-causas-raiz.md`** — diagnóstico técnico (por qué “100” no es garantizable literalmente) y plan por fases.
- **`audit-checklist-regresion.md`** — lista corta para CI manual antes de cerrar fases.

## Alcance

- Pipeline de imágenes (galería, portada, hero), SSR EJS, CSS/JS del sitio público, marketplace, widgets propios (p. ej. concierge).
- Fuera de alcance explícito aquí: panel SPA admin (otras iniciativas); integraciones de terceros no controladas por código si el cliente las incrusta por fuera.

## Estado

- **En curso** — thumbnails grid + FA modular (solid/brands) + preconnect unificado + **miniatura hero + srcset** + skip link / landmark principal + doc. **Thumbnails viejos en datos:** sync galería o nueva portada/card según `audit-causas-raiz.md`.

### Firebase Storage (403 en imágenes públicas)

- Reglas versionadas en el repo: **`backend/firebase/storage.rules`** + **`backend/firebase/firebase.json`** (lectura pública solo en `empresas/**`, una vez para todo el proyecto).
- Despliegue (sesión `firebase login` al proyecto correcto):

  ```bash
  cd backend
  npm run firebase:deploy-storage -- --project suite-manager-app
  ```

  Usa la CLI incluida en `devDependencies` (`firebase-tools`). Si el ID del proyecto es otro, cambiar `--project`.
