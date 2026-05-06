/**
 * Sugerencias de temas para el blog a partir de datos ya persistidos en SuiteManager.
 * Pensado para PostgreSQL (modo principal). En Firestore legacy devuelve sugerencias mínimas.
 */
const pool = require('../db/postgres');
const { IS_POSTGRES } = require('../config/dbConfig');
const { obtenerDetallesEmpresa } = require('./empresaService');
const { obtenerTodosCupones } = require('./cuponesService');
const { listRefSignatures, refSignature } = require('./blogPostService');

async function loadEmpresaForBlog(db, empresaId) {
    if (IS_POSTGRES && pool) {
        return obtenerDetallesEmpresa(db, empresaId);
    }
    const doc = await db.collection('empresas').doc(empresaId).get();
    if (!doc.exists) throw new Error('La empresa no fue encontrada.');
    const d = doc.data() || {};
    const cfg = d.configuracion && typeof d.configuracion === 'object' ? d.configuracion : {};
    return {
        id: empresaId,
        nombre: d.nombre || '',
        websiteSettings: d.websiteSettings || cfg.websiteSettings || {},
        ciudad: d.ciudad,
        ubicacionTexto: d.ubicacionTexto,
        ...cfg,
    };
}

function _hoyISO() {
    return new Date().toISOString().slice(0, 10);
}

function _cuponVigente(c) {
    if (!c || !c.activo) return false;
    const hoy = _hoyISO();
    const hasta = c.vigenciaHasta ? String(c.vigenciaHasta).slice(0, 10) : null;
    const desde = c.vigenciaDesde ? String(c.vigenciaDesde).slice(0, 10) : null;
    if (hasta && hoy > hasta) return false;
    if (desde && hoy < desde) return false;
    const maxU = Math.max(1, Number(c.usosMaximos) || 1);
    if (Number(c.usosActuales) >= maxU) return false;
    return true;
}

function _labelEspacioDestacado(item) {
    if (!item || typeof item !== 'object') return 'Espacio destacado';
    const titulo = String(item.titulo || item.title || item.nombre || '').trim();
    if (titulo) return titulo;
    const priv = item.privado && typeof item.privado === 'object' ? item.privado : null;
    const com = item.comun && typeof item.comun === 'object' ? item.comun : null;
    if (priv?.nombre) return String(priv.nombre);
    if (com?.nombre) return String(com.nombre);
    return 'Espacio destacado';
}

/**
 * @returns {Promise<Array<{ entryType: string, refPayload: object, label: string, hint: string }>>}
 */
async function listSuggestions(db, empresaId) {
    const existing = await listRefSignatures(db, empresaId);
    const out = [];

    if (!IS_POSTGRES || !pool) {
        out.push({
            entryType: 'freeform',
            refPayload: {},
            label: 'Tema libre',
            hint: 'Describe un tema (atracción, consejos de viaje, temporada, etc.) y genera el borrador con IA.',
        });
        return out;
    }

    const empresa = await loadEmpresaForBlog(db, empresaId);
    const ws = empresa.websiteSettings || {};
    const marketing = ws.marketing || {};
    const promos = Array.isArray(marketing.promocionesDestacadas) ? marketing.promocionesDestacadas : [];

    const { rows: propRows } = await pool.query(
        `SELECT id, nombre FROM propiedades WHERE empresa_id=$1 AND activo=true`,
        [empresaId]
    );
    const propNombre = new Map(propRows.map((r) => [String(r.id), r.nombre]));

    promos.forEach((pr, index) => {
        if (!pr || typeof pr !== 'object') return;
        const pct = Math.min(90, Math.max(0, Number(pr.porcentajeDescuento) || 0));
        if (pct <= 0) return;
        const refPayload = { promoIndex: index };
        const sig = refSignature('promotion_marketing', refPayload);
        if (existing.has(sig)) return;
        const pid = pr.propiedadId ? String(pr.propiedadId) : '';
        const pn = pid ? (propNombre.get(pid) || 'Alojamiento') : 'Varios alojamientos';
        out.push({
            entryType: 'promotion_marketing',
            refPayload,
            label: `Promoción destacada (${pn})`,
            hint: `Etiqueta: ${String(pr.etiqueta || 'Oferta')}. ${pct}% de descuento. Fechas marketing: ${pr.fechaDesde || '—'} → ${pr.fechaHasta || '—'}.`,
        });
    });

    const cupones = await obtenerTodosCupones(db, empresaId);
    for (const c of cupones) {
        if (!_cuponVigente(c)) continue;
        const refPayload = { cuponId: String(c.id) };
        if (existing.has(refSignature('coupon', refPayload))) continue;
        const esPersonal = !!c.clienteId;
        out.push({
            entryType: 'coupon',
            refPayload,
            label: esPersonal ? `Cupón activo (huésped específico)` : 'Cupón de descuento activo',
            hint: esPersonal
                ? `Descuento ${c.porcentajeDescuento}%. Vigencia: ${c.vigenciaDesde || '—'} → ${c.vigenciaHasta || 'sin fin'}. No publiques el código en redes abiertas salvo que la empresa lo decida.`
                : `Descuento aproximado ${c.porcentajeDescuento}%. Vigencia: ${c.vigenciaDesde || '—'} → ${c.vigenciaHasta || 'sin fin'}.`,
        });
    }

    const { rows: edRows } = await pool.query(
        `SELECT id, nombre,
                metadata->'buildContext'->'narrativa'->'espaciosDestacadosVenta' AS edv
         FROM propiedades
         WHERE empresa_id=$1 AND activo=true`,
        [empresaId]
    );
    for (const row of edRows) {
        const arr = Array.isArray(row.edv) ? row.edv : [];
        arr.forEach((item, itemIndex) => {
            const refPayload = { propiedadId: String(row.id), itemIndex };
            if (existing.has(refSignature('featured_space', refPayload))) return;
            out.push({
                entryType: 'featured_space',
                refPayload,
                label: `${_labelEspacioDestacado(item)} — ${row.nombre}`,
                hint: 'Espacio marcado como destacado en la ficha pública del alojamiento.',
            });
        });
    }

    const { rows: listedRows } = await pool.query(
        `SELECT id, nombre FROM propiedades
         WHERE empresa_id=$1 AND activo=true
           AND (metadata->'googleHotelData'->>'isListed')::boolean = true
         ORDER BY nombre
         LIMIT 8`,
        [empresaId]
    );
    for (const row of listedRows) {
        const refPayload = { propiedadId: String(row.id) };
        if (existing.has(refSignature('featured_property', refPayload))) continue;
        out.push({
            entryType: 'featured_property',
            refPayload,
            label: `Conoce ${row.nombre}`,
            hint: 'Entrada de presentación del alojamiento para SEO y confianza.',
        });
    }

    const { rows: acRows } = await pool.query(
        `SELECT configuracion->'areas_comunes' AS ac FROM empresas WHERE id=$1`,
        [empresaId]
    );
    const ac = acRows[0]?.ac;
    const espacios = ac && ac.activo && Array.isArray(ac.espacios) ? ac.espacios : [];
    for (const esp of espacios) {
        if (!esp || !esp.id) continue;
        const refPayload = { espacioId: String(esp.id) };
        if (existing.has(refSignature('common_area', refPayload))) continue;
        const nombre = String(esp.nombre || 'Espacio común');
        out.push({
            entryType: 'common_area',
            refPayload,
            label: `Área común: ${nombre}`,
            hint: 'Instalación compartida del recinto para huéspedes.',
        });
    }

    try {
        const { rows: trows } = await pool.query(
            `SELECT id, nombre, fecha_inicio, fecha_termino
             FROM temporadas WHERE empresa_id=$1
             ORDER BY fecha_inicio DESC NULLS LAST
             LIMIT 24`,
            [empresaId]
        );
        for (const t of trows) {
            const refPayload = { temporadaId: String(t.id) };
            if (existing.has(refSignature('season', refPayload))) continue;
            const fi = t.fecha_inicio ? String(t.fecha_inicio).slice(0, 10) : '';
            const ft = t.fecha_termino ? String(t.fecha_termino).slice(0, 10) : '';
            out.push({
                entryType: 'season',
                refPayload,
                label: `Temporada: ${t.nombre || 'Sin nombre'}`,
                hint: `Ventana: ${fi || '—'} → ${ft || '—'}. Enlaza tarifas y planificación de viaje sin inventar precios.`,
            });
        }
    } catch (_) {
        /* temporadas opcional */
    }

    out.push({
        entryType: 'freeform',
        refPayload: {},
        label: 'Tema libre',
        hint: 'Escribe tu propio tema (evento local, atracción, consejos). La IA usará solo los datos que indiques y el contexto de la empresa.',
    });

    return out.slice(0, 48);
}

/**
 * Construye texto de hechos verificables para el prompt de IA (anti-invención).
 */
async function buildBriefForEntry(db, empresaId, { entryType, refPayload = {}, userTopic = '' }) {
    const empresa = await loadEmpresaForBlog(db, empresaId);
    const nombreEmpresa = String(empresa.nombre || 'Alojamiento').trim();
    const ws = empresa.websiteSettings || {};
    const ciudad = ws.general?.ciudad || empresa.ciudad || empresa.ubicacionTexto || '';
    const region = ws.general?.region || '';
    const idioma = ws.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';

    const baseCtx = [
        `Empresa (nombre comercial): ${nombreEmpresa}`,
        ciudad ? `Ubicación aproximada (config sitio): ${ciudad}${region ? `, ${region}` : ''}` : '',
        `Idioma principal del sitio: ${idioma === 'en' ? 'inglés' : 'español'}`,
    ].filter(Boolean).join('\n');

    if (!IS_POSTGRES || !pool) {
        return {
            factsBlock: `${baseCtx}\n\nTema sugerido por el usuario:\n${String(userTopic || '').trim() || '(sin tema — redacta introducción a la empresa)'}`,
            entryType: entryType || 'freeform',
            refPayload,
        };
    }

    const rp = refPayload && typeof refPayload === 'object' ? refPayload : {};

    if (entryType === 'promotion_marketing') {
        const marketing = ws.marketing || {};
        const promos = Array.isArray(marketing.promocionesDestacadas) ? marketing.promocionesDestacadas : [];
        const idx = Math.max(0, parseInt(rp.promoIndex, 10) || 0);
        const pr = promos[idx];
        if (!pr) throw new Error('Promoción no encontrada en la configuración.');
        const { rows } = await pool.query(
            'SELECT nombre FROM propiedades WHERE id=$1 AND empresa_id=$2',
            [pr.propiedadId || null, empresaId]
        );
        const pn = rows[0]?.nombre || (pr.propiedadId ? String(pr.propiedadId) : 'varios');
        return {
            factsBlock: `${baseCtx}\n\nDATOS DE PROMOCIÓN (no contradecir):\n- Alojamiento vinculado: ${pn}\n- Etiqueta: ${String(pr.etiqueta || 'Oferta')}\n- Porcentaje descuento marketing: ${Number(pr.porcentajeDescuento) || 0}%\n- Fecha desde (marketing): ${pr.fechaDesde || 'no indicada'}\n- Fecha hasta (marketing): ${pr.fechaHasta || 'no indicada'}\n\nNo inventes porcentajes ni fechas distintas a las anteriores.`,
            entryType,
            refPayload: { promoIndex: idx },
        };
    }

    if (entryType === 'coupon') {
        const cuponId = String(rp.cuponId || '').trim();
        if (!cuponId) throw new Error('Falta cuponId en refPayload.');
        const { rows } = await pool.query(
            'SELECT * FROM cupones WHERE id=$1 AND empresa_id=$2',
            [cuponId, empresaId]
        );
        const row = rows[0];
        if (!row) throw new Error('Cupón no encontrado.');
        const c = {
            activo: row.activo,
            descuento: row.descuento,
            vigencia_desde: row.vigencia_desde,
            vigencia_hasta: row.vigencia_hasta,
            cliente_id: row.cliente_id,
            usos_actuales: row.usos_actuales,
            usos_maximos: row.usos_maximos,
        };
        const esPersonal = !!c.cliente_id;
        return {
            factsBlock: `${baseCtx}\n\nDATOS DE CUPÓN (no contradecir):\n- Descuento (${row.tipo_descuento || 'porcentaje'}): ${Number(c.descuento) || 0}\n- Vigencia desde: ${c.vigencia_desde ? String(c.vigencia_desde).slice(0, 10) : 'no indicada'}\n- Vigencia hasta: ${c.vigencia_hasta ? String(c.vigencia_hasta).slice(0, 10) : 'sin fin'}\n- Uso: ${esPersonal ? 'vinculado a un huésped concreto — NO publicar el código en medios abiertos salvo instrucción explícita de la empresa' : 'puede mencionarse una oferta genérica; no inventes un código si no se proporciona'}\n\nNo inventes códigos ni condiciones adicionales.`,
            entryType,
            refPayload: { cuponId },
        };
    }

    if (entryType === 'featured_space') {
        const propiedadId = String(rp.propiedadId || '').trim();
        const itemIndex = Math.max(0, parseInt(rp.itemIndex, 10) || 0);
        const { rows } = await pool.query(
            `SELECT nombre, metadata->'buildContext'->'narrativa'->'espaciosDestacadosVenta' AS edv
             FROM propiedades WHERE id=$1 AND empresa_id=$2`,
            [propiedadId, empresaId]
        );
        const row = rows[0];
        if (!row) throw new Error('Alojamiento no encontrado.');
        const arr = Array.isArray(row.edv) ? row.edv : [];
        const item = arr[itemIndex];
        if (!item) throw new Error('Espacio destacado no encontrado en índice indicado.');
        return {
            factsBlock: `${baseCtx}\n\nALOJAMIENTO: ${row.nombre}\nDESTACADO (JSON resumido, no inventar instalaciones):\n${JSON.stringify(item).slice(0, 4000)}`,
            entryType,
            refPayload: { propiedadId, itemIndex },
        };
    }

    if (entryType === 'featured_property') {
        const propiedadId = String(rp.propiedadId || '').trim();
        const { rows } = await pool.query(
            'SELECT nombre, descripcion, capacidad FROM propiedades WHERE id=$1 AND empresa_id=$2',
            [propiedadId, empresaId]
        );
        const row = rows[0];
        if (!row) throw new Error('Alojamiento no encontrado.');
        return {
            factsBlock: `${baseCtx}\n\nALOJAMIENTO: ${row.nombre}\nCapacidad (referencia): ${row.capacidad || 'no indicada'}\nDescripción corta en sistema:\n${String(row.descripcion || '').slice(0, 2000)}`,
            entryType,
            refPayload: { propiedadId },
        };
    }

    if (entryType === 'common_area') {
        const espacioId = String(rp.espacioId || '').trim();
        const { rows } = await pool.query(
            `SELECT configuracion->'areas_comunes' AS ac FROM empresas WHERE id=$1`,
            [empresaId]
        );
        const espacios = rows[0]?.ac?.espacios;
        const arr = Array.isArray(espacios) ? espacios : [];
        const esp = arr.find((e) => e && String(e.id) === espacioId);
        if (!esp) throw new Error('Espacio común no encontrado.');
        return {
            factsBlock: `${baseCtx}\n\nÁREA COMÚN (no contradecir nombres/elementos):\n${JSON.stringify(esp).slice(0, 4000)}`,
            entryType,
            refPayload: { espacioId },
        };
    }

    if (entryType === 'season') {
        const temporadaId = String(rp.temporadaId || '').trim();
        const { rows } = await pool.query(
            `SELECT nombre, fecha_inicio, fecha_termino FROM temporadas WHERE id=$1 AND empresa_id=$2`,
            [temporadaId, empresaId]
        );
        const row = rows[0];
        if (!row) throw new Error('Temporada no encontrada.');
        return {
            factsBlock: `${baseCtx}\n\nTEMPORADA: ${row.nombre}\nDesde: ${row.fecha_inicio ? String(row.fecha_inicio).slice(0, 10) : '—'}\nHasta: ${row.fecha_termino ? String(row.fecha_termino).slice(0, 10) : '—'}\n\nNo inventes tarifas numéricas; habla de planificación y experiencia.`,
            entryType,
            refPayload: { temporadaId },
        };
    }

    return {
        factsBlock: `${baseCtx}\n\nTEMA / INSTRUCCIÓN DEL USUARIO:\n${String(userTopic || '').trim() || 'Artículo general útil para huéspedes, ligado al destino y la empresa.'}`,
        entryType: 'freeform',
        refPayload: {},
    };
}

module.exports = {
    listSuggestions,
    buildBriefForEntry,
};
