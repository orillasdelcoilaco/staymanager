// backend/services/galeriaService.js
const { IS_POSTGRES } = require('../config/dbConfig');
const pool = require('../db/postgres');
const { v4: uuidv4 } = require('uuid');
const { uploadFile, deleteFileByPath } = require('./storageService');
const { optimizeImage } = require('./imageProcessingService');
const { getCounts: getCountsImpl } = require('./galeriaService.counts');

async function getGaleria(db, empresaId, propiedadId, filters = {}) {
    if (IS_POSTGRES) {
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

    if (IS_POSTGRES) {
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

/**
 * Elimina archivos del storage para una foto
 * @param {object} fotoData - Datos de la foto con storageUrl, thumbnailUrl, storagePath
 */
async function eliminarArchivosStorage(fotoData) {
    if (!fotoData) {
        console.log('[eliminarArchivosStorage] fotoData es null/undefined');
        return;
    }

    console.log(`[eliminarArchivosStorage] Procesando foto:`, {
        storageUrl: fotoData.storageUrl ? 'presente' : 'ausente',
        thumbnailUrl: fotoData.thumbnailUrl ? 'presente' : 'ausente',
        storagePath: fotoData.storagePath ? 'presente' : 'ausente'
    });

    // Función para normalizar URLs (extraer path relativo)
    const normalizeUrl = (url) => {
        if (!url || typeof url !== 'string') return '';

        // Si es URL completa de Firebase Storage, extraer path relativo
        if (url.includes('/o/')) {
            try {
                const pathPart = url.split('/o/')[1].split('?')[0];
                return decodeURIComponent(pathPart);
            } catch (error) {
                console.warn(`[normalizeUrl] Error decodificando URL: ${url}`, error.message);
                return url;
            }
        }

        // Si ya es path relativo, devolverlo tal cual
        return url;
    };

    // Colección de URLs únicas a eliminar
    const urlsToDelete = new Set();

    // Agregar todas las URLs posibles
    if (fotoData.storageUrl && typeof fotoData.storageUrl === 'string') {
        urlsToDelete.add(fotoData.storageUrl);
    }

    if (fotoData.thumbnailUrl && typeof fotoData.thumbnailUrl === 'string') {
        urlsToDelete.add(fotoData.thumbnailUrl);
    }

    if (fotoData.storagePath && typeof fotoData.storagePath === 'string') {
        urlsToDelete.add(fotoData.storagePath);
    }

    console.log(`[eliminarArchivosStorage] URLs encontradas: ${urlsToDelete.size}`);

    // Eliminar URLs duplicadas (mismo path relativo)
    const normalizedUrls = new Map(); // normalized -> original
    for (const url of urlsToDelete) {
        const normalized = normalizeUrl(url);
        if (normalized && !normalizedUrls.has(normalized)) {
            normalizedUrls.set(normalized, url);
        }
    }

    console.log(`[eliminarArchivosStorage] URLs únicas después de normalizar: ${normalizedUrls.size}`);

    // Eliminar cada archivo único
    const deletePromises = [];
    for (const [normalized, originalUrl] of normalizedUrls) {
        console.log(`[eliminarArchivosStorage] Eliminando: ${normalized}`);
        deletePromises.push(
            deleteFileByPath(originalUrl).catch(error => {
                console.warn(`[eliminarArchivosStorage] Error eliminando ${originalUrl}:`, error.message);
                // No re-lanzar el error - continuar con otros archivos
            })
        );
    }

    // Esperar que todas las eliminaciones terminen (con o sin error)
    await Promise.allSettled(deletePromises);

    console.log(`[eliminarArchivosStorage] Completado. Intentadas: ${normalizedUrls.size} eliminaciones`);
}

/**
 * Obtiene los datos de una foto de la base de datos
 * @returns {object|null} Datos de la foto o null si no existe
 */
async function obtenerDatosFoto(db, empresaId, propiedadId, fotoId) {
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `SELECT storage_url, thumbnail_url, storage_path FROM galeria
             WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3`,
            [fotoId, empresaId, propiedadId]
        );
        if (rows.length > 0) {
            return {
                storageUrl: rows[0].storage_url,
                thumbnailUrl: rows[0].thumbnail_url,
                storagePath: rows[0].storage_path
            };
        }
    } else {
        // Modo Firestore
        const fotoDoc = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').doc(propiedadId)
            .collection('galeria').doc(fotoId).get();
        if (fotoDoc.exists) {
            return fotoDoc.data();
        }
    }
    return null;
}

async function descartarFoto(db, empresaId, propiedadId, fotoId) {
    console.log(`[descartarFoto] Iniciando eliminación: foto=${fotoId}, empresa=${empresaId}, propiedad=${propiedadId}`);

    try {
        // Primero obtener los datos de la foto para tener las URLs de storage
        const fotoData = await obtenerDatosFoto(db, empresaId, propiedadId, fotoId);

        if (!fotoData) {
            console.warn(`[descartarFoto] No se encontraron datos para la foto ${fotoId}. Procediendo con eliminación de BD.`);
        } else {
            console.log(`[descartarFoto] Datos obtenidos:`, {
                tieneStorageUrl: !!fotoData.storageUrl,
                tieneThumbnailUrl: !!fotoData.thumbnailUrl,
                tieneStoragePath: !!fotoData.storagePath
            });
        }

        // Eliminar archivos del storage si existen
        console.log(`[descartarFoto] Eliminando archivos del storage...`);
        await eliminarArchivosStorage(fotoData);
        console.log(`[descartarFoto] Eliminación de storage completada`);

        // Eliminar de la base de datos
        console.log(`[descartarFoto] Eliminando de la base de datos...`);
        if (IS_POSTGRES) {
            const result = await pool.query(
                `DELETE FROM galeria WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3 RETURNING id`,
                [fotoId, empresaId, propiedadId]
            );
            console.log(`[descartarFoto] PostgreSQL: ${result.rowCount} fila(s) eliminada(s)`);
        } else {
            // Modo Firestore
            await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
                .collection('galeria').doc(fotoId).delete();
            console.log(`[descartarFoto] Firestore: documento eliminado`);
        }

        console.log(`[descartarFoto] Eliminación completada exitosamente para foto ${fotoId}`);

    } catch (error) {
        console.error(`[descartarFoto] ERROR eliminando foto ${fotoId}:`, error.message);
        console.error(`[descartarFoto] Stack trace:`, error.stack);

        // Re-lanzar el error para que la ruta pueda manejarlo
        throw new Error(`Error al eliminar foto ${fotoId}: ${error.message}`);
    }
}

async function confirmarFoto(db, empresaId, propiedadId, fotoId) {
    if (IS_POSTGRES) {
        await pool.query(
            `UPDATE galeria SET estado='auto', confianza=1.0, updated_at=NOW() WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3`,
            [fotoId, empresaId, propiedadId]
        );
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId).update({ estado: 'auto', confianza: 1.0 });
}

async function eliminarFoto(db, empresaId, propiedadId, fotoId) {
    console.log(`[eliminarFoto] Iniciando eliminación: foto=${fotoId}, empresa=${empresaId}, propiedad=${propiedadId}`);

    try {
        // Primero obtener los datos de la foto para tener las URLs de storage
        const fotoData = await obtenerDatosFoto(db, empresaId, propiedadId, fotoId);

        if (!fotoData) {
            console.warn(`[eliminarFoto] No se encontraron datos para la foto ${fotoId}. Procediendo con eliminación de BD.`);
        } else {
            console.log(`[eliminarFoto] Datos obtenidos:`, {
                tieneStorageUrl: !!fotoData.storageUrl,
                tieneThumbnailUrl: !!fotoData.thumbnailUrl,
                tieneStoragePath: !!fotoData.storagePath
            });
        }

        // Eliminar archivos del storage si existen
        console.log(`[eliminarFoto] Eliminando archivos del storage...`);
        await eliminarArchivosStorage(fotoData);
        console.log(`[eliminarFoto] Eliminación de storage completada`);

        // Eliminar de la base de datos
        console.log(`[eliminarFoto] Eliminando de la base de datos...`);
        if (IS_POSTGRES) {
            const result = await pool.query(
                `DELETE FROM galeria WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3 RETURNING id`,
                [fotoId, empresaId, propiedadId]
            );
            console.log(`[eliminarFoto] PostgreSQL: ${result.rowCount} fila(s) eliminada(s)`);
        } else {
            // Modo Firestore
            await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
                .collection('galeria').doc(fotoId).delete();
            console.log(`[eliminarFoto] Firestore: documento eliminado`);
        }

        console.log(`[eliminarFoto] Eliminación completada exitosamente para foto ${fotoId}`);

    } catch (error) {
        console.error(`[eliminarFoto] ERROR eliminando foto ${fotoId}:`, error.message);
        console.error(`[eliminarFoto] Stack trace:`, error.stack);

        // Re-lanzar el error para que la ruta pueda manejarlo
        throw new Error(`Error al eliminar foto ${fotoId}: ${error.message}`);
    }
}

async function syncToWebsite(db, empresaId, propiedadId) {
    if (IS_POSTGRES) {
        const { rows } = await pool.query(
            `SELECT id, storage_url, alt_text, espacio, espacio_id, orden
             FROM galeria
             WHERE empresa_id=$1 AND propiedad_id=$2 AND estado IN ('auto','manual') AND espacio_id IS NOT NULL
             ORDER BY orden ASC`,
            [empresaId, propiedadId]
        );

        // DEBUG: Log para diagnóstico del problema IMG-001
        console.log(`[DEBUG syncToWebsite] Propiedad: ${propiedadId}, Fotos encontradas: ${rows.length}`);
        if (rows.length > 0) {
            console.log(`[DEBUG syncToWebsite] Fotos con espacio_id: ${rows.filter(r => r.espacio_id).length}`);
            console.log(`[DEBUG syncToWebsite] Estados: ${rows.map(r => r.estado).join(', ')}`);
        }

        const images = {};
        let cardImage = null;
        for (const f of rows) {
            const imageObj = {
                imageId: f.id, storagePath: f.storage_url, altText: f.alt_text || '',
                title: `${f.espacio || 'Vista'} - ${f.alt_text || ''}`,
                description: f.alt_text || '', orden: f.orden || 0
            };
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

        // DEBUG: Log resultado final PostgreSQL
        console.log(`[DEBUG syncToWebsite] Resultado PostgreSQL: total=${rows.length}, componentes=${Object.keys(images).length}`);
        return { total: rows.length, componentes: Object.keys(images).length };
    }

    // Modo Firestore
    const fotosSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .collection('galeria').where('estado', 'in', ['auto', 'manual']).where('espacioId', '!=', null).get();

    // DEBUG: Log para diagnóstico del problema IMG-001
    console.log(`[DEBUG syncToWebsite] Propiedad: ${propiedadId}, Fotos Firestore: ${fotosSnap.size}`);
    if (fotosSnap.size > 0) {
        const estados = [];
        fotosSnap.docs.forEach(d => {
            const f = d.data();
            estados.push(f.estado || 'sin-estado');
        });
        console.log(`[DEBUG syncToWebsite] Estados Firestore: ${estados.join(', ')}`);
    }

    const images = {};
    let cardImage = null;
    fotosSnap.docs.forEach(d => {
        const f = d.data();
        const imageObj = {
            imageId: d.id, storagePath: f.storageUrl || f.storagePath, altText: f.altText || '',
            title: `${f.espacio || 'Vista'} - ${f.altText || ''}`,
            description: f.altText || '', orden: f.orden || 0
        };
        if (!images[f.espacioId]) images[f.espacioId] = [];
        images[f.espacioId].push(imageObj);
        if (!cardImage) cardImage = imageObj;
    });

    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
        .update({ 'websiteData.images': images, 'websiteData.cardImage': cardImage });

    // DEBUG: Log resultado final Firestore
    console.log(`[DEBUG syncToWebsite] Resultado Firestore: total=${fotosSnap.size}, componentes=${Object.keys(images).length}`);
    return { total: fotosSnap.size, componentes: Object.keys(images).length };
}

async function uploadFotoToGaleria(db, empresaId, propiedadId, files) {
    const results = [];
    for (const file of files) {
        const fotoId = uuidv4();
        const base = `empresas/${empresaId}/propiedades/${propiedadId}/galeria/${fotoId}`;
        const { buffer: fullBuffer  } = await optimizeImage(file.buffer, { maxWidth: 1200, quality: 82 });
        const { buffer: thumbBuffer } = await optimizeImage(file.buffer, { maxWidth: 400,  quality: 75 });
        const [storageUrl, thumbnailUrl] = await Promise.all([
            uploadFile(fullBuffer,  `${base}.webp`,       'image/webp'),
            uploadFile(thumbBuffer, `${base}_thumb.webp`, 'image/webp'),
        ]);

        if (IS_POSTGRES) {
            await pool.query(
                `INSERT INTO galeria (id, empresa_id, propiedad_id, storage_url, thumbnail_url, storage_path, confianza, estado, rol, alt_text, orden, origen)
                 VALUES ($1,$2,$3,$4,$5,$4,0.20,'pendiente','adicional','',99,'upload_manual')`,
                [fotoId, empresaId, propiedadId, storageUrl, thumbnailUrl]
            );
        } else {
            // Modo Firestore
            await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
                .collection('galeria').doc(fotoId).set({
                    storageUrl, thumbnailUrl, storagePath: storageUrl,
                    confianza: 0.2, estado: 'pendiente', rol: 'adicional',
                    altText: '', orden: 99, origen: 'upload_manual',
                    empresaId, propiedadId, created_at: new Date()
                });
        }

        results.push({
            id: fotoId, storageUrl, thumbnailUrl, storagePath: storageUrl,
            espacio: null, espacioId: null, confianza: 0.2,
            estado: 'pendiente', rol: 'adicional', altText: '',
            orden: 99, origen: 'upload_manual'
        });
    }
    return results;
}

async function getCounts(db, empresaId) {
    return getCountsImpl(db, empresaId);
}

async function setPortada(db, empresaId, propiedadId, fotoId) {
    if (IS_POSTGRES) {
        await pool.query(
            `UPDATE galeria SET rol='adicional', updated_at=NOW() WHERE empresa_id=$1 AND propiedad_id=$2 AND rol='portada'`,
            [empresaId, propiedadId]
        );
        await pool.query(
            `UPDATE galeria SET rol='portada', updated_at=NOW() WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3`,
            [fotoId, empresaId, propiedadId]
        );
    } else {
        // Modo Firestore
        // Primero, quitar portada actual
        const currentPortadaSnap = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').doc(propiedadId).collection('galeria')
            .where('rol', '==', 'portada').get();

        const batch = db.batch();
        currentPortadaSnap.docs.forEach(doc => {
            batch.update(doc.ref, { rol: 'adicional' });
        });

        // Establecer nueva portada
        const fotoRef = db.collection('empresas').doc(empresaId)
            .collection('propiedades').doc(propiedadId).collection('galeria').doc(fotoId);
        batch.update(fotoRef, { rol: 'portada' });

        await batch.commit();
    }
}

async function replaceFoto(db, empresaId, propiedadId, fotoId, file) {
    // Primero obtener los datos de la foto actual para eliminar archivos antiguos
    const fotoDataActual = await obtenerDatosFoto(db, empresaId, propiedadId, fotoId);

    const base = `empresas/${empresaId}/propiedades/${propiedadId}/galeria/${fotoId}`;
    const { buffer: fullBuffer  } = await optimizeImage(file.buffer, { maxWidth: 1200, quality: 82 });
    const { buffer: thumbBuffer } = await optimizeImage(file.buffer, { maxWidth: 400,  quality: 75 });
    const [storageUrl, thumbnailUrl] = await Promise.all([
        uploadFile(fullBuffer,  `${base}.webp`,       'image/webp'),
        uploadFile(thumbBuffer, `${base}_thumb.webp`, 'image/webp'),
    ]);

    if (IS_POSTGRES) {
        await pool.query(
            `UPDATE galeria SET storage_url=$1, thumbnail_url=$2, storage_path=$1, updated_at=NOW()
             WHERE id=$3 AND empresa_id=$4 AND propiedad_id=$5`,
            [storageUrl, thumbnailUrl, fotoId, empresaId, propiedadId]
        );
    } else {
        // Modo Firestore
        await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)
            .collection('galeria').doc(fotoId).update({
                storageUrl, thumbnailUrl, storagePath: storageUrl
            });
    }

    // Eliminar archivos antiguos del storage después de actualizar la BD
    // (hacerlo después para evitar problemas si falla la actualización)
    await eliminarArchivosStorage(fotoDataActual);

    return { storageUrl, thumbnailUrl };
}

/**
 * Devuelve fotos clasificadas agrupadas por espacio_id, incluyendo confianza y estado.
 * Usado por Paso 2 de Contenido Web para mostrar lo que ya está clasificado en galería.
 * Incluye también fotos pendientes (baja confianza) para que el usuario las revise.
 */
async function getGaleriaByEspacio(_db, empresaId, propiedadId) {
    const { rows } = await pool.query(
        `SELECT id, storage_url, thumbnail_url, alt_text, espacio, espacio_id, confianza, estado, orden
         FROM galeria
         WHERE empresa_id=$1 AND propiedad_id=$2
           AND espacio_id IS NOT NULL
           AND estado IN ('auto','manual','pendiente')
         ORDER BY espacio_id, orden ASC`,
        [empresaId, propiedadId]
    );
    const grouped = {};
    for (const f of rows) {
        if (!grouped[f.espacio_id]) grouped[f.espacio_id] = [];
        grouped[f.espacio_id].push({
            imageId:    f.id,
            storagePath: f.storage_url,
            thumbnail:  f.thumbnail_url || f.storage_url,
            altText:    f.alt_text || '',
            title:      f.espacio || '',
            confianza:  parseFloat(f.confianza || 0),
            estado:     f.estado,
        });
    }
    return grouped;
}

/**
 * Sube una o varias fotos al storage para un área común de empresa.
 * NO escribe en la tabla galeria (FK constraint propiedad_id NOT NULL).
 * Las URLs se guardan en empresas.configuracion.areas_comunes desde el frontend.
 */
async function uploadFotoEmpresaArea(_db, empresaId, areaId, files) {
    const results = [];
    for (const file of files) {
        const fotoId = uuidv4();
        const base = `empresas/${empresaId}/areas-comunes/${areaId}/${fotoId}`;
        const { buffer: fullBuffer  } = await optimizeImage(file.buffer, { maxWidth: 1200, quality: 82 });
        const { buffer: thumbBuffer } = await optimizeImage(file.buffer, { maxWidth: 400,  quality: 75 });
        const [storageUrl, thumbnailUrl] = await Promise.all([
            uploadFile(fullBuffer,  `${base}.webp`,       'image/webp'),
            uploadFile(thumbBuffer, `${base}_thumb.webp`, 'image/webp'),
        ]);
        results.push({ id: fotoId, storageUrl, thumbnailUrl, altText: '' });
    }
    return results;
}

module.exports = { getGaleria, updateFoto, descartarFoto, confirmarFoto, eliminarFoto, syncToWebsite, uploadFotoToGaleria, getCounts, setPortada, replaceFoto, getGaleriaByEspacio, uploadFotoEmpresaArea };
