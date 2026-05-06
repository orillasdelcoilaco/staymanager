/**
 * Entradas de blog del sitio público por empresa (panel + SSR).
 * Modo dual: PostgreSQL (principal) / Firestore bajo empresas/{id}/websiteBlogPosts.
 */
const { v4: uuidv4 } = require('uuid');
const { IS_POSTGRES } = require('../config/dbConfig');
const pool = require('../db/postgres');

function _stripUnsafeHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\sjavascript:/gi, '');
}

function _slugify(raw) {
    const s = String(raw || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 96);
    return s || 'entrada';
}

function _mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        empresaId: row.empresa_id,
        slug: row.slug,
        title: row.title,
        metaDescription: row.meta_description || '',
        excerpt: row.excerpt || '',
        status: row.status,
        entryType: row.entry_type,
        refKind: row.ref_kind || null,
        refPayload: row.ref_payload && typeof row.ref_payload === 'object' ? row.ref_payload : {},
        bodyHtml: row.body_html || '',
        featuredImageUrl: row.featured_image_url || null,
        aiExtras: row.ai_extras && typeof row.ai_extras === 'object' ? row.ai_extras : {},
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function _mapFirestoreDoc(id, data) {
    if (!data) return null;
    return {
        id,
        empresaId: data.empresaId,
        slug: data.slug,
        title: data.title,
        metaDescription: data.metaDescription || '',
        excerpt: data.excerpt || '',
        status: data.status || 'draft',
        entryType: data.entryType || 'freeform',
        refKind: data.refKind || null,
        refPayload: data.refPayload && typeof data.refPayload === 'object' ? data.refPayload : {},
        bodyHtml: data.bodyHtml || '',
        featuredImageUrl: data.featuredImageUrl || null,
        aiExtras: data.aiExtras && typeof data.aiExtras === 'object' ? data.aiExtras : {},
        publishedAt: data.publishedAt?.toDate?.() || data.publishedAt || null,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
    };
}

async function _nextUniqueSlugPg(empresaId, baseSlug, excludePostId) {
    let slug = baseSlug;
    let n = 0;
    while (n < 50) {
        const params = [empresaId, slug];
        let q = 'SELECT id FROM website_blog_posts WHERE empresa_id=$1 AND slug=$2';
        if (excludePostId) {
            q += ' AND id <> $3';
            params.push(excludePostId);
        }
        q += ' LIMIT 1';
        const { rows } = await pool.query(q, params);
        if (!rows[0]) return slug;
        n += 1;
        slug = `${baseSlug}-${n + 1}`;
    }
    return `${baseSlug}-${uuidv4().slice(0, 8)}`;
}

async function listPostsForPanel(db, empresaId) {
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `SELECT * FROM website_blog_posts WHERE empresa_id=$1 ORDER BY updated_at DESC`,
            [empresaId]
        );
        return rows.map(_mapRow);
    }
    const snap = await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts').get();
    return snap.docs
        .map((d) => _mapFirestoreDoc(d.id, d.data()))
        .filter(Boolean)
        .sort((a, b) => (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0));
}

async function listPublishedForSsr(db, empresaId, limit = 200) {
    const lim = Math.min(500, Math.max(1, Number(limit) || 200));
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `SELECT id, slug, title, meta_description, excerpt, published_at, updated_at, featured_image_url
             FROM website_blog_posts
             WHERE empresa_id=$1 AND status='published'
             ORDER BY published_at DESC NULLS LAST, updated_at DESC
             LIMIT ${lim}`,
            [empresaId]
        );
        return rows.map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            metaDescription: r.meta_description || '',
            excerpt: r.excerpt || '',
            publishedAt: r.published_at,
            updatedAt: r.updated_at,
            featuredImageUrl: r.featured_image_url || null,
        }));
    }
    const snap = await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts')
        .where('status', '==', 'published')
        .limit(lim)
        .get();
    const out = snap.docs.map((d) => {
        const m = _mapFirestoreDoc(d.id, d.data());
        return {
            id: m.id,
            slug: m.slug,
            title: m.title,
            metaDescription: m.metaDescription,
            excerpt: m.excerpt,
            publishedAt: m.publishedAt,
            updatedAt: m.updatedAt,
            featuredImageUrl: m.featuredImageUrl,
        };
    });
    return out.sort((a, b) => (b.publishedAt?.getTime?.() || 0) - (a.publishedAt?.getTime?.() || 0));
}

async function getById(db, empresaId, postId) {
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            'SELECT * FROM website_blog_posts WHERE id=$1 AND empresa_id=$2',
            [postId, empresaId]
        );
        return _mapRow(rows[0]);
    }
    const doc = await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts').doc(postId).get();
    if (!doc.exists) return null;
    return _mapFirestoreDoc(doc.id, doc.data());
}

async function getPublishedBySlug(db, empresaId, slug) {
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `SELECT * FROM website_blog_posts WHERE empresa_id=$1 AND slug=$2 AND status='published'`,
            [empresaId, slug]
        );
        return _mapRow(rows[0]);
    }
    const snap = await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts')
        .where('slug', '==', slug)
        .where('status', '==', 'published')
        .limit(1)
        .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return _mapFirestoreDoc(d.id, d.data());
}

/** Firma estable para deduplicar sugerencias vs entradas existentes */
function refSignature(entryType, refPayload) {
    const p = refPayload && typeof refPayload === 'object' ? refPayload : {};
    const keys = Object.keys(p).sort();
    const norm = {};
    keys.forEach((k) => { norm[k] = p[k]; });
    return `${entryType}:${JSON.stringify(norm)}`;
}

async function listRefSignatures(db, empresaId) {
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `SELECT entry_type, ref_payload FROM website_blog_posts WHERE empresa_id=$1`,
            [empresaId]
        );
        return new Set(rows.map((r) => refSignature(r.entry_type, r.ref_payload || {})));
    }
    const snap = await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts').get();
    const set = new Set();
    snap.docs.forEach((d) => {
        const m = d.data() || {};
        set.add(refSignature(m.entryType || 'freeform', m.refPayload || {}));
    });
    return set;
}

async function createPost(db, empresaId, payload) {
    const title = String(payload.title || '').trim().slice(0, 300);
    if (!title) throw new Error('El título es obligatorio.');
    const bodyHtml = _stripUnsafeHtml(String(payload.bodyHtml || ''));
    const status = payload.status === 'published' ? 'published' : 'draft';
    const entryType = String(payload.entryType || 'freeform').slice(0, 64);
    const refKind = payload.refKind != null ? String(payload.refKind).slice(0, 64) : null;
    const refPayload = payload.refPayload && typeof payload.refPayload === 'object' ? payload.refPayload : {};
    const baseSlug = _slugify(payload.slug || title);
    const metaDescription = String(payload.metaDescription || '').trim().slice(0, 320);
    const excerpt = String(payload.excerpt || '').trim().slice(0, 500);
    const featuredImageUrl = payload.featuredImageUrl
        ? String(payload.featuredImageUrl).trim().slice(0, 2000)
        : null;
    const aiExtras = payload.aiExtras && typeof payload.aiExtras === 'object' ? payload.aiExtras : {};

    if (IS_POSTGRES) {
        const slug = await _nextUniqueSlugPg(empresaId, baseSlug, null);
        const publishedAt = status === 'published' ? new Date() : null;
        const { rows } = await pool.query(
            `INSERT INTO website_blog_posts (
                empresa_id, slug, title, meta_description, excerpt, status, entry_type, ref_kind, ref_payload,
                body_html, featured_image_url, ai_extras, published_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13,NOW())
            RETURNING *`,
            [
                empresaId, slug, title, metaDescription || null, excerpt || null, status, entryType, refKind,
                JSON.stringify(refPayload), bodyHtml, featuredImageUrl, JSON.stringify(aiExtras), publishedAt,
            ]
        );
        return _mapRow(rows[0]);
    }

    const id = uuidv4();
    const fsSlug = baseSlug;
    const admin = require('firebase-admin');
    const ref = db.collection('empresas').doc(empresaId).collection('websiteBlogPosts').doc(id);
    const snap = await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts')
        .where('slug', '==', fsSlug).limit(1).get();
    const slug = snap.empty ? fsSlug : `${fsSlug}-${id.slice(0, 8)}`;
    const now = admin.firestore.Timestamp.now();
    const data = {
        empresaId,
        slug,
        title,
        metaDescription,
        excerpt,
        status,
        entryType,
        refKind,
        refPayload,
        bodyHtml,
        featuredImageUrl,
        aiExtras,
        publishedAt: status === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(data);
    return _mapFirestoreDoc(id, data);
}

async function updatePost(db, empresaId, postId, payload) {
    const existing = await getById(db, empresaId, postId);
    if (!existing) throw new Error('Entrada no encontrada.');

    const title = payload.title !== undefined ? String(payload.title).trim().slice(0, 300) : existing.title;
    if (!title) throw new Error('El título es obligatorio.');
    let slug = existing.slug;
    if (payload.slug !== undefined) {
        const base = _slugify(payload.slug || title);
        if (IS_POSTGRES) {
            slug = await _nextUniqueSlugPg(empresaId, base, postId);
        } else {
            slug = base;
        }
    }
    const bodyHtml = payload.bodyHtml !== undefined
        ? _stripUnsafeHtml(String(payload.bodyHtml))
        : existing.bodyHtml;
    let status = existing.status;
    if (payload.status === 'draft' || payload.status === 'published') status = payload.status;
    const metaDescription = payload.metaDescription !== undefined
        ? String(payload.metaDescription).trim().slice(0, 320)
        : existing.metaDescription;
    const excerpt = payload.excerpt !== undefined
        ? String(payload.excerpt).trim().slice(0, 500)
        : existing.excerpt;
    const featuredImageUrl = payload.featuredImageUrl !== undefined
        ? (payload.featuredImageUrl ? String(payload.featuredImageUrl).trim().slice(0, 2000) : null)
        : existing.featuredImageUrl;
    const aiExtras = payload.aiExtras !== undefined && typeof payload.aiExtras === 'object'
        ? payload.aiExtras
        : existing.aiExtras;

    let publishedAt = existing.publishedAt;
    if (status === 'published' && existing.status !== 'published') {
        publishedAt = new Date();
    }
    if (status === 'draft') publishedAt = null;

    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `UPDATE website_blog_posts SET
                slug=$3, title=$4, meta_description=$5, excerpt=$6, status=$7,
                body_html=$8, featured_image_url=$9, ai_extras=$10::jsonb,
                published_at=$11, updated_at=NOW()
             WHERE id=$1 AND empresa_id=$2 RETURNING *`,
            [
                postId, empresaId, slug, title, metaDescription || null, excerpt || null, status,
                bodyHtml, featuredImageUrl, JSON.stringify(aiExtras), publishedAt,
            ]
        );
        return _mapRow(rows[0]);
    }

    const admin = require('firebase-admin');
    const ref = db.collection('empresas').doc(empresaId).collection('websiteBlogPosts').doc(postId);
    const data = {
        slug,
        title,
        metaDescription,
        excerpt,
        status,
        bodyHtml,
        featuredImageUrl,
        aiExtras,
        publishedAt: publishedAt ? admin.firestore.Timestamp.fromDate(new Date(publishedAt)) : null,
        updatedAt: admin.firestore.Timestamp.now(),
    };
    await ref.update(data);
    const merged = { ...existing, ...data, publishedAt: publishedAt ? new Date(publishedAt) : null };
    return merged;
}

async function deletePost(db, empresaId, postId) {
    if (IS_POSTGRES) {
        const { rowCount } = await pool.query(
            'DELETE FROM website_blog_posts WHERE id=$1 AND empresa_id=$2',
            [postId, empresaId]
        );
        return { deleted: rowCount > 0 };
    }
    await db.collection('empresas').doc(empresaId).collection('websiteBlogPosts').doc(postId).delete();
    return { deleted: true };
}

module.exports = {
    listPostsForPanel,
    listPublishedForSsr,
    getById,
    getPublishedBySlug,
    createPost,
    updatePost,
    deletePost,
    listRefSignatures,
    refSignature,
    slugify: _slugify,
    stripUnsafeHtml: _stripUnsafeHtml,
};
