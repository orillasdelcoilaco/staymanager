# Checklist rápido — antes de dar por cerrada una fase PageSpeed

- [ ] `npm run build` en `backend` (regenera `public/css/website.css`).
- [ ] Home tenant: grid de propiedades usa imagen **ligera** (Network: primera petición de card ~thumb / peso acorde).
- [ ] Tras **Sync galería** o cambio portada: `websiteData.cardImage` incluye `thumbnailUrl` cuando exista en galería.
- [ ] Lighthouse móvil (lab) en URL de prueba: anotar **Performance / A11y / BP / SEO** (no solo una métrica).
- [ ] Sin regresión multi-tenant: una empresa no ve assets de otra.
- [ ] Tras subir **portada**: `heroImageThumbUrl` presente en tema y home sirve `srcset` (Network: candidato ~960w en viewport estrecho).
- [ ] Teclado: **Saltar al contenido** visible al enfocar; foco llega a `#main-content`.
- [ ] Marketplace / catálogo GH: íconos FA visibles (solid + brands).
