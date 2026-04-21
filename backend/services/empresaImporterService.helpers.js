/**
 * empresaImporterService.helpers.js
 *
 * Helpers puros y funciones de construcción de datos del importador de empresas.
 * Exportadas para uso exclusivo de empresaImporterService.steps.js.
 */

const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { uploadFile } = require('./storageService');

// ─────────────────────────────────────────────
// HELPERS PUROS
// ─────────────────────────────────────────────

function normalizeKey(str) {
    return (str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim()
        .replace(/\s+/g, ' ');
}

function singularKey(str) {
    const k = normalizeKey(str);
    if (k.endsWith('es')) return k.slice(0, -2);
    if (k.endsWith('s'))  return k.slice(0, -1);
    return k;
}

function genCompId(nombre, index) {
    const slug = normalizeKey(nombre).replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return `${slug}-${index}`;
}

function findTipoElemento(nombre, tiposElemMap) {
    const key = normalizeKey(nombre);
    if (tiposElemMap.has(key)) return tiposElemMap.get(key);
    for (const [k, v] of tiposElemMap.entries()) {
        if (k.includes(key) || key.includes(k)) return v;
    }
    return null;
}

function matchUrlToComponentType(url) {
    const u = url.toLowerCase();
    if (/dorm|bedroom|pieza|cuarto|habitaci|cama|bed/.test(u))           return 'dormitorio';
    if (/ba[ñn]o|bath|wc|toilet|ducha|shower/.test(u))                  return 'bano';
    if (/cocin|kitchen/.test(u))                                          return 'cocina';
    if (/living|sala|estar/.test(u))                                      return 'living';
    if (/comedor|dining/.test(u))                                         return 'comedor';
    if (/terraz|patio|balcon/.test(u))                                    return 'terraza';
    if (/exterior|outside|front|facade|fachada|entrada/.test(u))          return 'exterior';
    if (/piscin|pool|jacuzzi|tinaja|quincho|bbq|parrilla/.test(u))        return 'amenidad';
    return null;
}

function componentTypeKey(comp) {
    const t = (comp.nombreTipo || comp.tipo || comp.nombre || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/dorm|pieza|bedroom|habitaci/.test(t)) return 'dormitorio';
    if (/ban|bath|wc/.test(t))                 return 'bano';
    if (/cocin|kitchen/.test(t))               return 'cocina';
    if (/living|sala|estar|interior/.test(t))  return 'living';
    if (/comedor|dining/.test(t))              return 'comedor';
    if (/terraz|patio|balcon/.test(t))         return 'terraza';
    if (/exterior|outside/.test(t))            return 'exterior';
    return 'general';
}

function matchSpaceNameToKey(spaceName) {
    const t = (spaceName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/dorm|pieza|bedroom|habitaci/.test(t)) return 'dormitorio';
    if (/ban|bath|wc/.test(t))                 return 'bano';
    if (/cocin|kitchen/.test(t))               return 'cocina';
    if (/living|sala|estar|interior/.test(t))  return 'living';
    if (/comedor|dining/.test(t))              return 'comedor';
    if (/terraz|patio|balcon/.test(t))         return 'terraza';
    if (/exterior|outside|fachada|entrada/.test(t)) return 'exterior';
    return 'general';
}

/**
 * Distribuye URLs de imágenes entre componentes usando keyword matching y clasificaciones Vision.
 * Devuelve: { [componentId]: [url, ...] }
 */
function distribuirImagenesPorComponente(imageUrls, componentes, maxPorEspacio = 3, clasificaciones = []) {
    const resultado = {};
    const usadas = new Set();

    if (clasificaciones.length > 0) {
        const porEspacio = {};
        for (const { url, espacio } of clasificaciones) {
            const key = matchSpaceNameToKey(espacio);
            (porEspacio[key] = porEspacio[key] || []).push(url);
        }
        for (const comp of componentes) {
            const key = componentTypeKey(comp);
            const candidatas = (porEspacio[key] || []).filter(u => !usadas.has(u));
            const asignadas = candidatas.slice(0, maxPorEspacio);
            asignadas.forEach(u => usadas.add(u));
            if (asignadas.length > 0) resultado[comp.id] = asignadas;
        }
    }

    const sinClasificar = imageUrls.filter(u => !usadas.has(u));
    const porTipoUrl = {};
    const sinTipo = [];
    for (const url of sinClasificar) {
        const tipo = matchUrlToComponentType(url);
        if (tipo) { (porTipoUrl[tipo] = porTipoUrl[tipo] || []).push(url); }
        else        sinTipo.push(url);
    }
    for (const comp of componentes) {
        const actuales = resultado[comp.id] || [];
        if (actuales.length >= maxPorEspacio) continue;
        const key = componentTypeKey(comp);
        const candidatas = (porTipoUrl[key] || []).filter(u => !usadas.has(u));
        const faltan = maxPorEspacio - actuales.length;
        const nuevas = candidatas.slice(0, faltan);
        nuevas.forEach(u => usadas.add(u));
        if (nuevas.length > 0) resultado[comp.id] = [...actuales, ...nuevas];
    }

    let sinTipoIdx = 0;
    for (const comp of componentes) {
        const actuales = resultado[comp.id] || [];
        const adicionales = [];
        while (actuales.length + adicionales.length < maxPorEspacio && sinTipoIdx < sinTipo.length) {
            const url = sinTipo[sinTipoIdx++];
            if (!usadas.has(url)) { adicionales.push(url); usadas.add(url); }
        }
        const total = [...actuales, ...adicionales];
        if (total.length > 0) resultado[comp.id] = total;
    }

    return resultado;
}

/**
 * Construye un mapa url → { espacio, espacioId, confianza, espacioLabel, orden }
 * a partir de la distribución por componente y las clasificaciones Vision.
 */
function buildClasificacionMap(imagenesPorComp, imagenesClasificadas, componentes) {
    const visionUrls = new Set(
        (imagenesClasificadas || [])
            .filter(c => normalizeKey(c.espacio || '') !== 'general')
            .map(c => c.url)
    );

    const map = new Map();
    for (const comp of componentes) {
        const urls = imagenesPorComp[comp.id] || [];
        const espacioLabel = comp.nombreTipo || comp.nombre || comp.tipo || 'Vista';
        urls.forEach((url, orden) => {
            const isVision = visionUrls.has(url);
            const isUrlKeyword = matchUrlToComponentType(url) !== null;
            const confianza = isVision ? 0.85 : isUrlKeyword ? 0.5 : 0.3;
            map.set(url, { espacio: espacioLabel, espacioId: comp.id, confianza, espacioLabel, orden });
        });
    }
    return map;
}

/**
 * Sube TODAS las imágenes al Storage (full 1200px + thumbnail 400px),
 * crea documentos en la galería de Firestore, y retorna websiteImages
 * (solo fotos con confianza >= 0.5) para mantener compatibilidad SSR.
 */
async function importarGaleriaPropiedad(todasLasUrls, clasificacionMap, db, empresaId, propiedadId, aloj, empresaNombre) {
    const urls = [...new Set(todasLasUrls)].filter(u => u && typeof u === 'string');
    if (urls.length === 0) return { websiteImages: {}, cardImage: null, totalGaleria: 0 };

    const galeriaRef = db.collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria');

    const websiteImages = {};
    let cardImage = null;
    let totalGaleria = 0;
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const clasif = clasificacionMap.get(url);
        const imageId = uuidv4();

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SuiteManager-Importer/1.0)' }
            });
            clearTimeout(timeout);
            if (!res.ok) { console.warn(`[Importer] ⚠️  HTTP ${res.status}: ${url}`); continue; }

            const buffer = Buffer.from(await res.arrayBuffer());

            const fullBuffer = await sharp(buffer)
                .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();

            const thumbBuffer = await sharp(buffer)
                .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 75 })
                .toBuffer();

            const espacioLabel = clasif?.espacioLabel || 'Vista';
            const altText = `${espacioLabel} - ${aloj.nombre} | ${empresaNombre}`;

            const storagePath = `empresas/${empresaId}/propiedades/${propiedadId}/images/${imageId}.webp`;
            const thumbPath   = `empresas/${empresaId}/propiedades/${propiedadId}/thumbs/${imageId}.webp`;

            const [storageUrl, thumbnailUrl] = await Promise.all([
                uploadFile(fullBuffer, storagePath, 'image/webp'),
                uploadFile(thumbBuffer, thumbPath, 'image/webp')
            ]);

            const confianza = clasif?.confianza ?? 0.2;
            const estado = confianza >= 0.5 ? 'auto' : 'pendiente';

            const fotoDoc = {
                originalUrl: url,
                storagePath,
                storageUrl,
                thumbnailUrl,
                espacio:    clasif?.espacio   || null,
                espacioId:  clasif?.espacioId || null,
                confianza,
                estado,
                rol:        (clasif?.orden ?? 99) === 0 ? 'principal' : 'adicional',
                altText,
                orden:      clasif?.orden ?? 99,
                fechaImport: new Date().toISOString()
            };

            batch.set(galeriaRef.doc(imageId), fotoDoc);
            batchCount++;
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }

            if (estado === 'auto' && clasif?.espacioId) {
                const imageObj = {
                    imageId,
                    storagePath: storageUrl,
                    altText,
                    title: `${aloj.nombre} – ${espacioLabel}`,
                    description: (clasif.orden === 0)
                        ? (aloj.descripcionVisual || aloj.descripcion || altText)
                        : altText,
                    orden: clasif.orden
                };
                if (!websiteImages[clasif.espacioId]) websiteImages[clasif.espacioId] = [];
                websiteImages[clasif.espacioId].push(imageObj);
                if (!cardImage) cardImage = imageObj;
            }

            totalGaleria++;
            const tag = estado === 'auto' ? '✅' : '⏳';
            console.log(`[Importer]   🖼️  ${i + 1}/${urls.length} ${tag} ${espacioLabel} (conf=${confianza.toFixed(2)})`);
        } catch (err) {
            console.warn(`[Importer] ⚠️  Imagen ${i + 1}/${urls.length} fallida: ${err.message}`);
        }
    }

    if (batchCount > 0) await batch.commit();
    return { websiteImages, cardImage, totalGaleria };
}

function buildComponentes(alojamiento, tiposCompMap, tiposElemMap) {
    const {
        espaciosDetectados = [],
        activosEspecificos = [],
        numDormitorios = 1,
        numBanos = 1
    } = alojamiento;

    const activosPorEspacio = {};
    for (const activo of activosEspecificos) {
        const key = normalizeKey(activo.espacio || 'general');
        if (!activosPorEspacio[key]) activosPorEspacio[key] = [];
        activosPorEspacio[key].push(activo);
    }

    const componentes = [];
    const visitados = new Set();
    let idx = 0;

    for (const espacioNombre of espaciosDetectados) {
        const baseName = espacioNombre.replace(/\s+\d+$/, '').trim();
        const keyNorm = normalizeKey(baseName);
        if (visitados.has(keyNorm)) continue;
        visitados.add(keyNorm);

        const tipo = tiposCompMap.get(keyNorm) || tiposCompMap.get(singularKey(baseName));
        if (!tipo) continue;

        let copias = 1;
        if (/dorm|bedroom|pieza|habitaci/i.test(baseName)) copias = Math.max(1, numDormitorios || 1);
        else if (/ba[ñn]o|bath|wc/i.test(baseName)) copias = Math.max(1, numBanos || 1);

        for (let i = 0; i < copias; i++) {
            const compNombre = copias > 1 ? `${baseName} ${i + 1}` : baseName;
            const activosClave = activosPorEspacio[keyNorm] || [];

            const elementos = activosClave
                .map(activo => {
                    const te = findTipoElemento(activo.nombre, tiposElemMap);
                    if (!te) return null;
                    return { tipoId: te.id, nombre: te.nombre, cantidad: activo.cantidad || 1, icono: te.icono || '🔹' };
                })
                .filter(Boolean);

            componentes.push({
                id: genCompId(compNombre, idx++),
                nombre: compNombre,
                tipo: tipo.id,
                nombreTipo: tipo.nombreNormalizado,
                elementos
            });
        }
    }

    if (componentes.length === 0) {
        componentes.push({ id: 'general-0', nombre: 'Principal', tipo: null, nombreTipo: 'General', elementos: [] });
    }

    return componentes;
}

module.exports = {
    normalizeKey,
    singularKey,
    genCompId,
    findTipoElemento,
    matchUrlToComponentType,
    componentTypeKey,
    matchSpaceNameToKey,
    distribuirImagenesPorComponente,
    buildClasificacionMap,
    importarGaleriaPropiedad,
    buildComponentes,
};
