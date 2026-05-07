# SM-pagespeed-lighthouse-max

## Objetivo

Acercar **todas** las URLs SSR tenant (`website.*`) y **rezerva.cl** (marketplace / páginas públicas plataforma) al **máximo realista** en Lighthouse / PageSpeed Insights (rendimiento, accesibilidad, buenas prácticas, SEO), sin sacrificar multi-tenant ni seguridad.

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

### Repair masivo de imágenes web (galería + card + hero)

Desde la raíz del repo, con `.env` / `serviceAccountKey.json` como en desarrollo:

```bash
# Una empresa (por subdomain) — regenera todas las thumbs rotas o con --force todas
node scripts/tooling/repair-web-images.js --subdomain=TUSUBDOMINIO --apply --force

# Todas las empresas (PostgreSQL)
node scripts/tooling/repair-web-images.js --all-empresas --apply --force

# Además: recomprimir el archivo FULL del hero en Storage (mejor LCP; nuevo token en URL)
node scripts/tooling/repair-web-images.js --subdomain=TUSUBDOMINIO --apply --force --recompress-hero-full
```

`--force` hace que se **vuelvan a generar** miniaturas aunque ya parezcan válidas (compress más agresivo en repair). `--recompress-hero-full` solo tiene efecto con `--apply --force`.

Panel (JWT): `POST /api/website/maintenance/regenerate-web-images` con JSON opcional `{ "force": true, "recompressHeroFull": true }`.
