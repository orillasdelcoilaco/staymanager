-- Blog público por empresa (entradas tipadas + brief IA)
-- node backend/scripts/apply-sql-migration.js db/migrations/website-blog-posts.sql

CREATE TABLE IF NOT EXISTS website_blog_posts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    slug               TEXT NOT NULL,
    title              TEXT NOT NULL,
    meta_description   TEXT,
    excerpt            TEXT,
    status             TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    entry_type         TEXT NOT NULL DEFAULT 'freeform',
    ref_kind           TEXT,
    ref_payload        JSONB NOT NULL DEFAULT '{}',
    body_html          TEXT NOT NULL DEFAULT '',
    featured_image_url TEXT,
    ai_extras          JSONB NOT NULL DEFAULT '{}',
    published_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_blog_posts_empresa_status_pub
    ON website_blog_posts (empresa_id, status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_website_blog_posts_empresa_updated
    ON website_blog_posts (empresa_id, updated_at DESC);
