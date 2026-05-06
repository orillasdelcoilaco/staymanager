/**
 * API panel: blog del sitio público (/api/website/blog/*).
 */
const { ssrCache } = require('../services/cacheService');
const {
    listPostsForPanel,
    getById,
    createPost,
    updatePost,
    deletePost,
} = require('../services/blogPostService');
const { listSuggestions, buildBriefForEntry } = require('../services/blogSuggestionsService');
const { generateBlogInternalDraftJson } = require('../services/blogInternalAiService');
const { AI_TASK } = require('../services/ai/aiEnums');
const { sanitizeInput } = require('../services/ai/prompts/sanitizer');
const { promptBlogPostDraft } = require('../services/ai/prompts/blogPost');
const { pickFirstString } = require('../services/aiResponseNormalize');
const { IS_POSTGRES } = require('../config/dbConfig');
const pool = require('../db/postgres');

const MAX_PASTED_AI_CHARS = 600000;

function invalidateSsrCache(empresaId) {
    try {
        if (empresaId) ssrCache.invalidateEmpresaCache(empresaId);
    } catch (err) {
        console.warn(`[blog] SSR cache: ${err.message}`);
    }
}

const ENTRY_LABELS = {
    promotion_marketing: 'Promoción / oferta destacada',
    coupon: 'Cupón de descuento',
    featured_space: 'Espacio destacado del alojamiento',
    featured_property: 'Presentación de alojamiento',
    common_area: 'Área común del recinto',
    season: 'Temporada de tarifas',
    freeform: 'Tema libre',
};

/**
 * Misma validación y brief que generate-draft, sin llamar al modelo.
 * @returns {Promise<{ brief: object, prompt: string }>}
 */
async function prepareBlogDraftPrompt(db, empresaId, body) {
    const {
        entryType = 'freeform',
        refPayload = {},
        userTopic = '',
        includeReelScript = false,
    } = body || {};

    if ((!IS_POSTGRES || !pool) && entryType !== 'freeform') {
        const err = new Error('Las entradas tipadas (promociones, cupones, etc.) requieren PostgreSQL. Usa «Tema libre» o migra la base.');
        err.statusCode = 400;
        throw err;
    }

    let safeTopic = '';
    try {
        safeTopic = sanitizeInput(userTopic, AI_TASK.BLOG_POST_DRAFT, { empresaId, campo: 'userTopic' });
    } catch (err) {
        if (err.code === 'AI_INJECTION_DETECTED') {
            const e = new Error('El texto del tema contiene patrones no permitidos.');
            e.statusCode = 400;
            throw e;
        }
        throw err;
    }

    const brief = await buildBriefForEntry(db, empresaId, {
        entryType,
        refPayload,
        userTopic: safeTopic,
    });

    const prompt = promptBlogPostDraft({
        factsBlock: brief.factsBlock,
        includeReelScript: !!includeReelScript,
        entryTypeLabel: ENTRY_LABELS[brief.entryType] || brief.entryType,
    });

    return { brief, prompt };
}

function unwrapBlogDraftAiJson(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const nestKeys = ['result', 'data', 'output', 'response', 'articulo', 'post', 'blogPost', 'draft'];
    for (const k of nestKeys) {
        const inner = raw[k];
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            const t = pickFirstString(inner, ['title', 'titulo', 'metaTitle']);
            const b = pickFirstString(inner, ['bodyHtml', 'html', 'content', 'cuerpo', 'texto']);
            if (t && b) return inner;
        }
    }
    return raw;
}

function parsePastedBlogAiResponse(pasted) {
    let s = String(pasted ?? '').trim();
    if (!s.length) {
        const err = new Error('Pega aquí la respuesta de tu IA (JSON).');
        err.statusCode = 400;
        throw err;
    }
    if (s.length > MAX_PASTED_AI_CHARS) {
        const err = new Error('El texto pegado es demasiado largo.');
        err.statusCode = 400;
        throw err;
    }
    const fence = /```(?:json)?\s*([\s\S]*?)```/i;
    const m = s.match(fence);
    if (m) s = m[1].trim();

    let raw;
    try {
        raw = JSON.parse(s);
    } catch (_) {
        const err = new Error('No es JSON válido. Copia el objeto JSON que devolvió la IA (puedes incluir el bloque ```json … ```).');
        err.statusCode = 400;
        throw err;
    }

    const unwrapped = unwrapBlogDraftAiJson(raw);
    return unwrapped && typeof unwrapped === 'object' ? unwrapped : raw;
}

function mountOnRouter(router, db) {
    router.get('/blog/posts', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const posts = await listPostsForPanel(db, empresaId);
            res.json({ posts });
        } catch (e) { next(e); }
    });

    router.get('/blog/posts/:id', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const post = await getById(db, empresaId, req.params.id);
            if (!post) return res.status(404).json({ error: 'No encontrado' });
            res.json({ post });
        } catch (e) { next(e); }
    });

    router.post('/blog/posts', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const post = await createPost(db, empresaId, req.body || {});
            invalidateSsrCache(empresaId);
            res.status(201).json({ post });
        } catch (e) { next(e); }
    });

    router.patch('/blog/posts/:id', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const post = await updatePost(db, empresaId, req.params.id, req.body || {});
            invalidateSsrCache(empresaId);
            res.json({ post });
        } catch (e) {
            if (e.message === 'Entrada no encontrada.') return res.status(404).json({ error: e.message });
            next(e);
        }
    });

    router.delete('/blog/posts/:id', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const r = await deletePost(db, empresaId, req.params.id);
            if (!r.deleted) return res.status(404).json({ error: 'No encontrado' });
            invalidateSsrCache(empresaId);
            res.json({ ok: true });
        } catch (e) { next(e); }
    });

    router.get('/blog/suggestions', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const suggestions = await listSuggestions(db, empresaId);
            res.json({ suggestions });
        } catch (e) { next(e); }
    });

    router.post('/blog/prompt-for-draft', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { brief, prompt } = await prepareBlogDraftPrompt(db, empresaId, req.body);
            res.json({
                prompt,
                entryType: brief.entryType,
                entryTypeLabel: ENTRY_LABELS[brief.entryType] || brief.entryType,
            });
        } catch (e) {
            if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
            next(e);
        }
    });

    router.post('/blog/posts/from-external-ai', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const body = req.body || {};
            const { pastedText, ...promptCtx } = body;

            const { brief } = await prepareBlogDraftPrompt(db, empresaId, promptCtx);
            const raw = parsePastedBlogAiResponse(pastedText);
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                return res.status(400).json({ error: 'La respuesta debe ser un objeto JSON con título y cuerpo.' });
            }

            const title = pickFirstString(raw, ['title', 'titulo', 'metaTitle']);
            const bodyHtml = pickFirstString(raw, ['bodyHtml', 'html', 'content', 'cuerpo', 'texto']);
            if (!title || !bodyHtml) {
                return res.status(400).json({
                    error: 'Falta título o cuerpo en el JSON. Claves esperadas: title/titulo y bodyHtml/html/content.',
                });
            }

            const metaDescription = pickFirstString(raw, ['metaDescription', 'meta_description', 'description']);
            const excerpt = pickFirstString(raw, ['excerpt', 'resumen', 'summary']);
            const slug = pickFirstString(raw, ['slug']);
            const faq = Array.isArray(raw.faq) ? raw.faq : [];
            const reelScript = raw.reelScript != null ? raw.reelScript : null;

            const post = await createPost(db, empresaId, {
                title,
                slug: slug || undefined,
                metaDescription,
                excerpt,
                bodyHtml,
                status: 'draft',
                entryType: brief.entryType,
                refKind: brief.entryType,
                refPayload: brief.refPayload,
                aiExtras: {
                    faq,
                    reelScript,
                    source: 'external_ai',
                    generatedAt: new Date().toISOString(),
                },
            });

            invalidateSsrCache(empresaId);
            res.status(201).json({ post });
        } catch (e) {
            if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
            if (e.message && /no encontrad|no encontrada|Falta cuponId/i.test(e.message)) {
                return res.status(400).json({ error: e.message });
            }
            next(e);
        }
    });

    /**
     * Borrador con IA solo del blog: claves BLOG_INTERNAL_* (`blogInternalAiService`).
     * No usa `generateForTask` ni las API keys globales del panel (GROQ_API_KEY, etc.).
     */
    router.post('/blog/internal/generate-draft', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { brief, prompt } = await prepareBlogDraftPrompt(db, empresaId, req.body);

            const raw = await generateBlogInternalDraftJson(prompt);
            if (!raw || typeof raw !== 'object') {
                return res.status(503).json({ error: 'La IA del blog no devolvió contenido. Reintenta o revisa BLOG_INTERNAL_* en el servidor.' });
            }

            const title = pickFirstString(raw, ['title', 'titulo', 'metaTitle']);
            const bodyHtml = pickFirstString(raw, ['bodyHtml', 'html', 'content', 'cuerpo', 'texto']);
            if (!title || !bodyHtml) {
                return res.status(503).json({ error: 'Respuesta de IA incompleta (falta título o cuerpo).' });
            }

            const metaDescription = pickFirstString(raw, ['metaDescription', 'meta_description', 'description']);
            const excerpt = pickFirstString(raw, ['excerpt', 'resumen', 'summary']);
            const slug = pickFirstString(raw, ['slug']);
            const faq = Array.isArray(raw.faq) ? raw.faq : [];
            const reelScript = raw.reelScript != null ? raw.reelScript : null;

            const post = await createPost(db, empresaId, {
                title,
                slug: slug || undefined,
                metaDescription,
                excerpt,
                bodyHtml,
                status: 'draft',
                entryType: brief.entryType,
                refKind: brief.entryType,
                refPayload: brief.refPayload,
                aiExtras: {
                    faq,
                    reelScript,
                    source: 'blog_internal_ai',
                    generatedAt: new Date().toISOString(),
                },
            });

            invalidateSsrCache(empresaId);
            res.status(201).json({ post });
        } catch (e) {
            if (e.statusCode === 429 || e.code === 'AI_QUOTA_EXCEEDED') {
                return res.status(429).json({ error: e.message || 'Cuota de IA del blog excedida.' });
            }
            if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
            if (e.message && /no encontrad|no encontrada|Falta cuponId/i.test(e.message)) {
                return res.status(400).json({ error: e.message });
            }
            next(e);
        }
    });
}

module.exports = { mountOnRouter };
