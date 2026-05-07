# SM-blog-publico — Blog del sitio público (entradas tipadas + IA)

## Objetivo

Publicar artículos por `empresa_id` en el SSR (`/blog`, `/blog/:slug`) con datos tomados del PMS cuando aplica (promociones destacadas, cupones, espacios destacados, temporadas, etc.) y borradores con flujo **IA externa** (prompt en panel → pegar JSON) u opción **IA interna solo blog** (claves dedicadas, no mezcladas con el resto del panel).

## Estado

- **2026-05-05:** MVP en código: migración SQL, API panel, vistas SSR, menú SPA.
- **Posterior:** IA interna del blog desacoplada de `generateForTask` global: servicio `blogInternalAiService.js`, ruta `POST …/blog/internal/generate-draft`; variables solo `BLOG_INTERNAL_*`. Prompt sin modelo: `POST …/blog/prompt-for-draft`; pegado JSON: `POST …/blog/posts/from-external-ai`.

## Operación

1. Aplicar migración en Supabase (o entorno PG):  
   `node backend/scripts/apply-sql-migration.js db/migrations/website-blog-posts.sql`
2. Panel: **Sitio público → Blog público** — sugerencias / tema libre → **Generar prompt** → copiar a ChatGPT/Gemini → pegar JSON → **Crear borrador desde pegado**, o **Generar borrador (IA interna)** si el servidor tiene `BLOG_INTERNAL_*` configuradas → **Publicar**.
3. URL viva: `https://{subdominio}.rezerva.cl/blog`

## Render (producción / staging)

- Las variables **`BLOG_INTERNAL_*`** **no** están en el repo: hay que definirlas en el **dashboard de Render** → servicio Web → **Environment** (igual que `DATABASE_URL`, `GROQ_API_KEY` del producto, etc.).
- **Solo** hace falta si quieres el botón **IA interna del blog** en ese entorno. El flujo **solo IA externa** (prompt + pegar JSON) **no** requiere `BLOG_INTERNAL_*`.
- Referencia de nombres: `backend/.env.example` (bloque «IA interna solo del blog») y comentarios en `backend/services/blogInternalAiService.js`.

## Archivos principales

| Área | Archivo |
|------|---------|
| SQL | `backend/db/migrations/website-blog-posts.sql` |
| Persistencia | `backend/services/blogPostService.js` |
| Sugerencias / brief | `backend/services/blogSuggestionsService.js` |
| IA interna solo blog (sin claves globales) | `backend/services/blogInternalAiService.js` |
| Prompt IA (texto) | `backend/services/ai/prompts/blogPost.js`; sanitización tema: `AI_TASK.BLOG_POST_DRAFT` en `aiEnums.js` |
| API | `backend/routes/websiteBlogApi.js` (montaje en `api/ssr/config.routes.js`) — rutas: `prompt-for-draft`, `posts/from-external-ai`, `internal/generate-draft`, CRUD posts |
| SSR | `backend/routes/website.blog.js`, `backend/views/blog-index.ejs`, `blog-post.ejs`, `website.seo.js` (sitemap) |
| SPA | `frontend/src/views/websiteBlog.js`, `router.js` |
| Límite IA panel (ruta pesada interna blog) | `backend/middleware/aiPanelGenerationLimiter.js` — coincide con `blog/internal/generate-draft` |

## Pendientes naturales (no bloquean MVP)

- Editor rico / preview HTML en panel; subida de imagen destacada con flujo galería.
- Enlace «Blog» en `partials/header.ejs` si el tenant tiene publicaciones.
- Dedupe más fino de sugerencias vs campañas duplicadas.

## Notas

- Modo **solo Firestore** (sin PG): solo **tema libre** para entradas tipadas; persistencia en subcolección `websiteBlogPosts`. En producción se espera PG.
