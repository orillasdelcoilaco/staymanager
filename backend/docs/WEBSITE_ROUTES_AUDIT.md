# Router del panel: `/api/website` → `backend/api/ssr/config.routes.js`

## Montaje

En `backend/index.js`:

```js
const websitePanelRoutes = require('./api/ssr/config.routes.js');
apiRouter.use('/website', websitePanelRoutes(db));
```

No existe otro archivo paralelo en `backend/routes/` para estas rutas.

---

## Superficies relevantes

| Área | Notas |
|------|--------|
| Config general / términos | `PUT /home-settings` incluye `terminosCondiciones` vía `mergeTerminosCondiciones`. |
| Google Hotels | `GET /google-hotels-health`. |
| Términos — plantilla | `GET /terminos-condiciones/plantilla`. |
| JSON-LD | `POST .../build-context/generate-jsonld`: prevalidación, IA + `unwrapSeoJsonLdResult`, galería PG + fallback `websiteData`, `spacesToContainsPlace`, logs `validateJsonLd`. |
| Perfil empresa | `POST /optimize-profile` con `getEmpresaContext` → `generarPerfilEmpresa`. |
| Uploads wizard | `POST .../upload-image/:componentId`, card image, hero, etc. (todo en este router). |

---

## Historial

El duplicado **`backend/routes/websiteConfigRoutes.js`** y el extracto **`websiteConfigRoutes.propiedadUploadImage.js`** se eliminaron (2026-04): no estaban montados y la lógica equivalente ya estaba en **`config.routes.js`**.
