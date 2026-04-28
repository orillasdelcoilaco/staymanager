// backend/services/empresaService.js
const pool = require('../db/postgres');
const { ssrCache } = require('./cacheService');

function normalizeSubdomain(rawValue) {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63);
}

function normalizeCompanyName(rawValue) {
    return String(rawValue || '').trim().replace(/\s+/g, ' ');
}

async function ensureEmpresaIdentityUniqueness(empresaId, nombreValue, subdominioValue) {
    if (nombreValue) {
        const { rows } = await pool.query(
            `SELECT id, nombre
             FROM empresas
             WHERE id <> $1
               AND LOWER(TRIM(nombre)) = LOWER(TRIM($2))
             LIMIT 1`,
            [empresaId, nombreValue]
        );
        if (rows[0]) {
            const err = new Error('Ya existe una empresa con ese nombre. Usa un nombre único.');
            err.statusCode = 409;
            throw err;
        }
    }

    if (subdominioValue) {
        const { rows } = await pool.query(
            `SELECT id
             FROM empresas
             WHERE id <> $1
               AND (
                    LOWER(TRIM(COALESCE(subdominio, ''))) = LOWER(TRIM($2))
                    OR LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) = LOWER(TRIM($2))
                    OR LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) = LOWER(TRIM($2))
               )
             LIMIT 1`,
            [empresaId, subdominioValue]
        );
        if (rows[0]) {
            const err = new Error('El subdominio ya está en uso por otra empresa.');
            err.statusCode = 409;
            throw err;
        }
    }
}

function mapPgConflict(error) {
    if (error && error.code === '23505') {
        const err = new Error('Conflicto de unicidad: el nombre o subdominio ya existe.');
        err.statusCode = 409;
        return err;
    }
    return error;
}

function mapearEmpresa(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        email: row.email,
        plan: row.plan,
        dominio: row.dominio,
        subdominio: row.subdominio,
        google_maps_url: row.google_maps_url || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.configuracion || {})
    };
}

const obtenerDetallesEmpresa = async (_db, empresaId) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');
    const { rows } = await pool.query('SELECT * FROM empresas WHERE id = $1', [empresaId]);
    if (!rows[0]) throw new Error('La empresa no fue encontrada.');
    return mapearEmpresa(rows[0]);
};

const actualizarDetallesEmpresa = async (_db, empresaId, datos) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');
    const { nombre, email, plan, dominio, subdominio, google_maps_url, ...resto } = datos;
    const nombreFinal = normalizeCompanyName(nombre);

    let dominioFinal = dominio;
    let subdominioFinal = normalizeSubdomain(subdominio);

    if (resto.websiteSettings?.general?.subdomain) {
        const sub = normalizeSubdomain(resto.websiteSettings.general.subdomain);
        resto.websiteSettings.general.subdomain = sub;
        subdominioFinal = subdominioFinal || sub;
        if (sub && !resto.websiteSettings.general.domain) {
            resto.websiteSettings.general.domain = `${sub}.suitemanagers.com`;
        }
        dominioFinal = dominioFinal || resto.websiteSettings.general.domain;
        resto.websiteSettings.subdomain = sub;
        resto.websiteSettings.domain = dominioFinal;
    }

    await ensureEmpresaIdentityUniqueness(
        empresaId,
        nombreFinal || null,
        subdominioFinal || null
    );

    // Obtener configuración actual para hacer merge inteligente
    let configuracionActual = {};
    try {
        const { rows } = await pool.query(
            'SELECT configuracion FROM empresas WHERE id = $1',
            [empresaId]
        );

        if (rows[0] && rows[0].configuracion) {
            configuracionActual = rows[0].configuracion;
            console.log(`[SQL UPDATE empresas] Configuración actual encontrada con keys:`, Object.keys(configuracionActual));
        }
    } catch (error) {
        console.warn(`[SQL UPDATE empresas] No se pudo obtener configuración actual:`, error.message);
    }

    // Hacer merge inteligente con deep merge para websiteSettings
    let configuracionFinal = { ...configuracionActual, ...resto };

    // Si resto tiene websiteSettings, hacer deep merge (no sobrescribir completamente)
    if (resto.websiteSettings && configuracionActual.websiteSettings) {
        console.log(`[SQL UPDATE empresas] Haciendo deep merge de websiteSettings`);
        // Deep merge: combinar websiteSettings existente con el nuevo
        configuracionFinal.websiteSettings = {
            ...configuracionActual.websiteSettings,
            ...resto.websiteSettings,
            // Deep merge para sub-objetos específicos si existen
            ...(resto.websiteSettings.general && {
                general: { ...configuracionActual.websiteSettings?.general, ...resto.websiteSettings.general }
            }),
            ...(resto.websiteSettings.theme && {
                theme: { ...configuracionActual.websiteSettings?.theme, ...resto.websiteSettings.theme }
            }),
            ...(resto.websiteSettings.content && {
                content: { ...configuracionActual.websiteSettings?.content, ...resto.websiteSettings.content }
            }),
            ...(resto.websiteSettings.seo && {
                seo: { ...configuracionActual.websiteSettings?.seo, ...resto.websiteSettings.seo }
            }),
            ...(resto.websiteSettings.houseRules && {
                houseRules: {
                    ...(configuracionActual.websiteSettings?.houseRules || {}),
                    ...resto.websiteSettings.houseRules,
                    ...(resto.websiteSettings.houseRules.items && {
                        items: {
                            ...(configuracionActual.websiteSettings?.houseRules?.items || {}),
                            ...resto.websiteSettings.houseRules.items,
                        },
                    }),
                },
            }),
            ...(resto.websiteSettings.integrations && {
                integrations: {
                    ...(configuracionActual.websiteSettings?.integrations || {}),
                    ...resto.websiteSettings.integrations,
                },
            }),
        };
        console.log(`[SQL UPDATE empresas] websiteSettings después de deep merge:`, Object.keys(configuracionFinal.websiteSettings));
    } else if (resto.websiteSettings) {
        // Si no hay websiteSettings existente, usar el nuevo
        console.log(`[SQL UPDATE empresas] Usando nuevo websiteSettings (no había existente)`);
        configuracionFinal.websiteSettings = resto.websiteSettings;
    } else if (configuracionActual.websiteSettings) {
        // Si no se envía nuevo websiteSettings, preservar el existente
        console.log(`[SQL UPDATE empresas] Preservando websiteSettings existente (no se envió nuevo)`);
        configuracionFinal.websiteSettings = configuracionActual.websiteSettings;
    }

    const sql = `
        UPDATE empresas SET
            nombre          = COALESCE($2, nombre),
            email           = COALESCE($3, email),
            plan            = COALESCE($4, plan),
            dominio         = COALESCE($5, dominio),
            subdominio      = COALESCE($6, subdominio),
            configuracion   = $7::jsonb,  -- ¡CAMBIO CRÍTICO! Usar SET en lugar de ||
            google_maps_url = COALESCE($8, google_maps_url),
            updated_at      = NOW()
        WHERE id = $1
    `;

    const params = [
        empresaId,
        nombreFinal || null,
        email   || null,
        plan    || null,
        dominioFinal    || null,
        subdominioFinal || null,
        JSON.stringify(configuracionFinal),  // Usar configuracionFinal en lugar de resto
        google_maps_url || null
    ];

    console.log(`[SQL UPDATE empresas] Query:`, sql);
    console.log(`[SQL UPDATE empresas] Params:`, params);
    console.log(`[SQL UPDATE empresas] resto (configuración):`, JSON.stringify(resto, null, 2));

    let result;
    try {
        result = await pool.query(sql, params);
    } catch (error) {
        throw mapPgConflict(error);
    }
    console.log(`[SQL UPDATE empresas] Resultado: ${result.rowCount} fila(s) afectada(s)`);

    if (result.rowCount > 0) {
        try {
            ssrCache.invalidateEmpresaCache(empresaId);
        } catch (e) {
            console.warn('[SQL UPDATE empresas] No se pudo invalidar cache SSR:', e.message);
        }
    }

    // Obtener y devolver los datos actualizados
    const { rows } = await pool.query('SELECT * FROM empresas WHERE id = $1', [empresaId]);
    console.log(`[SQL UPDATE empresas] Datos actualizados:`, rows[0] ? 'OK' : 'NO ENCONTRADO');

    return rows[0] ? mapearEmpresa(rows[0]) : null;
};

const obtenerProximoIdNumericoCarga = async (_db, empresaId) => {
    const { rows } = await pool.query(
        `SELECT COALESCE(MAX(id_numerico), 0) + 1 AS proximo FROM historial_cargas WHERE empresa_id = $1`,
        [empresaId]
    );
    return rows[0].proximo;
};

const obtenerEmpresaPorDominio = async (_db, hostname) => {
    const hostLower = (hostname || '').toLowerCase().trim();

    if (
        hostLower.endsWith('.onrender.com') ||
        hostLower.endsWith('.suitemanager.com') ||
        hostLower.endsWith('.suitemanagers.com')
    ) {
        const subdomain = normalizeSubdomain(hostLower.split('.')[0]);
        // LOWER() para comparación case-insensitive (por si el subdominio fue guardado con mayúsculas)
        const { rows } = await pool.query(
            'SELECT * FROM empresas WHERE LOWER(subdominio) = $1 LIMIT 1', [subdomain]
        );
        if (rows[0]) return mapearEmpresa(rows[0]);

        const { rows: rows2 } = await pool.query(
            `SELECT * FROM empresas
             WHERE configuracion->>'websiteSettings' IS NOT NULL
               AND LOWER(configuracion->'websiteSettings'->>'subdomain') = $1
             LIMIT 1`,
            [subdomain]
        );
        if (rows2[0]) return mapearEmpresa(rows2[0]);

        // Fallback tolerante para datos legacy con espacios/acentos/símbolos.
        const { rows: rows3 } = await pool.query(
            `SELECT * FROM empresas
             WHERE LOWER(regexp_replace(COALESCE(subdominio, ''), '[^a-z0-9]+', '', 'g'))
                   = LOWER(regexp_replace($1, '[^a-z0-9]+', '', 'g'))
             LIMIT 1`,
            [subdomain]
        );
        if (rows3[0]) return mapearEmpresa(rows3[0]);

        const { rows: rows4 } = await pool.query(
            `SELECT * FROM empresas
             WHERE LOWER(regexp_replace(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''), '[^a-z0-9]+', '', 'g'))
                   = LOWER(regexp_replace($1, '[^a-z0-9]+', '', 'g'))
             LIMIT 1`,
            [subdomain]
        );
        if (rows4[0]) return mapearEmpresa(rows4[0]);
    }

    const { rows } = await pool.query(
        'SELECT * FROM empresas WHERE LOWER(dominio) = $1 LIMIT 1', [hostLower]
    );
    if (rows[0]) return mapearEmpresa(rows[0]);

    const { rows: rows2 } = await pool.query(
        `SELECT * FROM empresas WHERE LOWER(configuracion->'websiteSettings'->>'domain') = $1 LIMIT 1`,
        [hostLower]
    );
    return rows2[0] ? mapearEmpresa(rows2[0]) : null;
};

module.exports = {
    obtenerDetallesEmpresa,
    actualizarDetallesEmpresa,
    obtenerProximoIdNumericoCarga,
    obtenerEmpresaPorDominio,
    normalizeSubdomain,
};
