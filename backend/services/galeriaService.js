// backend/services/galeriaService.js
const pool = require('../db/postgres');
const { v4: uuidv4 } = require('uuid');
const { uploadFile } = require('./storageService');
const { optimizeImage } = require('./imageProcessingService');

async function getGaleria(db, empresaId, propiedadId, filters = {}) {
    if (pool) {
        let query = `SELECT id, original_url, storage_path, storage_url, thumbnail_url,
                            espacio, espacio_id, confianza, estado, rol, alt_text, orden, origen, created_at
                     FROM galeria WHERE empresa_id = $1 AND propiedad_id = $2`;
        const params = [empresaId, propiedadId];
        if (filters.estado) { params.push(filters.estado); query += ` AND estado = $${params.length}`; }
        if (filters.espacio) { params.push(filters.espacio); query += ` AND espacio = $${params.length}`; }
        query += ' ORDER BY orden ASC';
        const { rows } = await pool.query(query, params);
        return rows.map(r => ({
            id: r.id, originalUrl: r.original_url, storagePath: r.storage_path,
            storageUrl: r.storage_url, thumbnailUrl: r.thumbnail_url,
            espacio: r.espacio, espacioId: r.espacio_id, confianza: parseFloat(r.confianza),
            estado: r.estado, rol: r.rol, altText: r.alt_text,
            orden: r.orden, origen: r.origen, fechaImport: r.created_at,
        }));
    }

    let query = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId).collection('galeria');
    if (filters.estado) query = query.where('estado', '==', filters.estado);
    if (filters.espacio) query = query.where('espacio', '==', filters.espacio);
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

async function updateFoto(db, empresaId, propiedadId, fotoId, updates) {
    const allowed = ['espacio', 'espacioId', 'estado', 'rol', 'orden', 'altText'];
    const data = {};
    for (const key of allowed) { if (updates[key] !== undefined) data[key] = updates[key]; }
    if (updates.espacio !== undefined) {
        if (updates.espacio) { data.estado = 'manual'; data.confianza = 1.0; }
        else { data.estado = 'pendiente'; data.confianza = 0.2; data.espacioId = null; }
    }
    if (Object.keys(data).length === 0) return;

    if (pool) {
        const sets = [], params = [];
        if (data.espacio    !== undefined) { sets.push(`espacio=$${params.push(data.espacio)}`); }
        if (data.espacioId  !== undefined) { sets.push(`espacio_id=$${params.push(data.espacioId)}`); }
        if (data.estado     !== undefined) { sets.push(`estado=$${params.push(data.estado)}`); }
        if (data.confianza  !== undefined) { sets.push(`confianza=$${params.push(data.confianza)}`); }
        if (data.rol        !== undefined) { sets.push(`rol=$${params.push(data.rol)}`); }
        if (data.orden      !== undefined) { sets.push(`orden=$${params.push(data.orden)}`); }
        if (data.altText    !== undefined) { sets.push(`alt_text=$${params.push(data.altText)}`); }
        if (sets.length) {
            sets.push('updated_at=NOW()');
            params.push(fotoId, empresaId, propiedadId);
            await pool.query(
                `UPDATE galeria SET ${sets.join(',')} WHERE id=$${params.length-2} AND empresa_id=$${params.length-1} AND propiedad_id=$${params.length}`,
                params
            );
        }
        return;
    }

    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId).update(data);
}

async function descartarFoto(db, empresaId, propiedadId, fotoId) {
    if (pool) {
        await pool.query(
            `UPDATE galeria SET estado='descartada', updated_at=NOW() WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3`,
            [fotoId, empresaId, propiedadId]
        );
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId).update({ estado: 'descartada' });
}

async function confirmarFoto(db, empresaId, propiedadId, fotoId) {
    if (pool) {
        await pool.query(
            `UPDATE galeria SET estado='auto', confianza=1.0, updated_at=NOW() WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3`,
            [fotoId, empresaId, propiedadId]
        );
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId).update({ estado: 'auto', confianza: 1.0 });
}

async function syncToWebsite(db, empresaId, propiedadId) {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT id, storage_url, alt_text, espacio, espacio_id, orden
             FROM galeria
             WHERE empresa_id=$1 AND propiedad_id=$2 AND estado IN ('auto','manual') AND espacio_id IS NOT NULL
             ORDER BY orden ASC`,
            [empresaId, propiedadId]
        );
        const images = {};
        let cardImage = null;
        for (const f of rows) {
            const imageObj = { imageId: f.id, storagePath: f.storage_url, altText: f.alt_text || '', title: `${f.espacio || 'Vista'} - ${f.alt_text || ''}`, description: f.alt_text || '', orden: f.orden || 0 };
            if (!images[f.espacio_id]) images[f.espacio_id] = [];
            images[f.espacio_id].push(imageObj);
            if (!cardImage) cardImage = imageObj;
        }
        await pool.query(
            `UPDATE propiedades
             SET metadata = metadata || jsonb_build_object('websiteData',
                 COALESCE(metadata->'websiteData','{}') || jsonb_build_object('images',$3::jsonb,'cardImage',$4::jsonb)
             ), updated_at = NOW()
             WHERE id = $2 AND empresa_id = $1`,
            [empresaId, propiedadId, JSON.stringify(images), JSON.stringify(cardImage)]
        );
        return { total: rows.length, componentes: Object.keys(images).length };
    }

    const snap = await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .collection('galeria').where('estado', 'in', ['auto', 'manual']).get();
    const images = {};
    let cardImage = null;
    const fotos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => f.espacioId).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
    for (const foto of fotos) {
        const imageObj = { imageId: foto.id, storagePath: foto.storageUrl, altText: foto.altText || '', title: `${foto.espacio || 'Vista'} - ${foto.altText || ''}`, description: foto.altText || '', orden: foto.orden || 0 };
        if (!images[foto.espacioId]) images[foto.espacioId] = [];
        images[foto.espacioId].push(imageObj);
        if (!cardImage) cardImage = imageObj;
    }
    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .update({ 'websiteData.images': images, 'websiteData.cardImage': cardImage });
    return { total: fotos.length, componentes: Object.keys(images).length };
}

async function uploadFotoToGaleria(db, empresaId, propiedadId, files, nombreEmpresa = '') {
    const results = [];
    for (const file of files) {
        const fotoId = uuidv4();
        const base = `empresas/${empresaId}/propiedades/${propiedadId}/galeria/${fotoId}`;
        const { buffer: fullBuffer }  = await optimizeImage(file.buffer, { maxWidth: 1200, quality: 82 });
        const { buffer: thumbBuffer } = await optimizeImage(file.buffer, { maxWidth: 400,  quality: 75 });
        const [storageUrl, thumbnailUrl] = await Promise.all([
            uploadFile(fullBuffer,  `${base}.webp`,       'image/webp'),
            uploadFile(thumbBuffer, `${base}_thumb.webp`, 'image/webp'),
        ]);
        const fotoData = { storageUrl, thumbnailUrl, storagePath: storageUrl, espacio: null, espacioId: null, confianza: 0.2, estado: 'pendiente', rol: 'adicional', altText: '', orden: 99, fechaImport: new Date().toISOString(), origen: 'upload_manual' };

        if (pool) {
            await pool.query(
                `INSERT INTO galeria (id, empresa_id, propiedad_id, storage_url, thumbnail_url, storage_path, confianza, estado, rol, alt_text, orden, origen)
                 VALUES ($1,$2,$3,$4,$5,$5,0.20,'pendiente','adicional',''  ,99,'upload_manual')`,
                [fotoId, empresaId, propiedadId, storageUrl, thumbnailUrl]
            );
        } else {
            await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
                .collection('galeria').doc(fotoId).set(fotoData);
        }
        results.push({ id: fotoId, ...fotoData });
    }
    return results;
}

module.exports = { getGaleria, updateFoto, descartarFoto, confirmarFoto, syncToWebsite, uploadFotoToGaleria };
