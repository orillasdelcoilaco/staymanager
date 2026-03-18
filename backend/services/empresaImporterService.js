/**
 * empresaImporterService.js
 *
 * Crea O ACTUALIZA una empresa en Firestore a partir de ImportData.
 * Si el email ya existe → modo actualización (no crea usuario nuevo).
 * Lógica "upsert" en todos los niveles: solo agrega lo que falta.
 *
 * Secuencia:
 *  1. Buscar empresa existente por email (collectionGroup 'users')
 *     → Si existe: modo UPDATE (usa empresaId existente)
 *     → Si no existe: modo CREATE (llama register())
 *  2. Actualizar info de empresa (nombre, slogan, historia…)
 *  3. Canal "Venta Directa": crear solo si no existe
 *  4. TiposElemento: crear solo los que no existen por nombre
 *  5. TiposComponente: crear solo los que no existen por nombreNormalizado
 *  6. Propiedades: crear si no existe, actualizar descripción si ya existe
 *  7. Tarifas: upsert por alojamientoId + temporada
 */

const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { register } = require('./authService');
const { crearTipo: crearTipoElemento, obtenerTipos } = require('./tiposElementoService');
const { crearTipoComponente, analizarNuevoTipoConIA, obtenerTiposPorEmpresa } = require('./componentesService');
const { crearPropiedad } = require('./propiedadesService');
const { crearCanal, obtenerCanalesPorEmpresa } = require('./canalesService');
const { analizarMetadataActivo } = require('./aiContentService');
const { uploadFile } = require('./storageService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function normalizeKey(str) {
    return (str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim()
        .replace(/\s+/g, ' ');
}

// Reduce a forma singular en español: "habitaciones"→"habitacion", "baños"→"bano"
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

/**
 * Mapea keywords de URL a tipos de componente para distribuir imágenes por espacio.
 */
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

/**
 * Distribuye URLs de imágenes entre componentes usando keyword matching de la URL original.
 * Devuelve: { [componentId]: [url, ...] }
 */
/**
 * Normaliza un nombre de espacio (devuelto por Vision) al mismo key que usa componentTypeKey.
 * Ej: "Cocina" → "cocina", "Baño" → "bano", "Sala de Estar" → "living"
 */
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
 * Distribuye URLs de imágenes entre componentes.
 * Fuente primaria: clasificaciones de Vision (imagenesClasificadas).
 * Fallback: keyword matching en la URL.
 * @param {string[]} imageUrls - todas las URLs de imágenes del alojamiento
 * @param {object[]} componentes - array de componentes con .id y .nombreTipo/.nombre
 * @param {number} maxPorEspacio - máximo de imágenes por componente
 * @param {{ url: string, espacio: string }[]} clasificaciones - resultado de Vision
 */
function distribuirImagenesPorComponente(imageUrls, componentes, maxPorEspacio = 3, clasificaciones = []) {
    const resultado = {};
    const usadas = new Set();

    // ── Fuente 1: clasificaciones Vision ────────────────────────────────────
    if (clasificaciones.length > 0) {
        // Agrupar por key de espacio
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

    // ── Fuente 2: keyword matching en la URL (para imágenes no clasificadas) ─
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

    // ── Fuente 3: imágenes sin match → rellenar componentes que aún tienen menos del mínimo ─
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
 *
 * @param {string[]} todasLasUrls — todas las URLs del alojamiento (hasta 40)
 * @param {Map} clasificacionMap  — url → { espacio, espacioId, confianza, ... }
 * @param db — Firestore instance
 * @param {string} empresaId
 * @param {string} propiedadId
 * @param {object} aloj          — datos del alojamiento
 * @param {string} empresaNombre
 * @returns {{ websiteImages, cardImage, totalGaleria }}
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

            // Full size: 1200×900 WebP q82
            const fullBuffer = await sharp(buffer)
                .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();

            // Thumbnail: 400×300 WebP q75
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

            // websiteData.images solo incluye fotos con confianza suficiente
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
        const keyNorm = normalizeKey(espacioNombre);
        if (visitados.has(keyNorm)) continue;
        visitados.add(keyNorm);

        const tipo = tiposCompMap.get(keyNorm) || tiposCompMap.get(singularKey(espacioNombre));
        if (!tipo) continue;

        let copias = 1;
        if (/dorm|bedroom|pieza|habitaci/i.test(espacioNombre)) copias = Math.max(1, numDormitorios || 1);
        else if (/ba[ñn]o|bath|wc/i.test(espacioNombre)) copias = Math.max(1, numBanos || 1);

        for (let i = 0; i < copias; i++) {
            const compNombre = copias > 1 ? `${espacioNombre} ${i + 1}` : espacioNombre;
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

// ─────────────────────────────────────────────
// BUSCAR EMPRESA EXISTENTE POR EMAIL
// ─────────────────────────────────────────────

async function findEmpresaByEmail(adminSdk, db, email) {
    try {
        // Paso 1: buscar uid en Firebase Auth (no requiere índice Firestore)
        const userRecord = await adminSdk.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        // Paso 2: buscar empresaId via collectionGroup por uid (índice ya existe en authMiddleware)
        const snapshot = await db.collectionGroup('users').where('uid', '==', uid).get();
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        const empresaId = doc.ref.parent.parent.id;
        return { empresaId, uid };
    } catch (err) {
        if (err.code === 'auth/user-not-found') return null; // Email nuevo → crear
        console.warn(`[Importer] findEmpresaByEmail error: ${err.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────
// RESET: borra todas las subcolecciones de la empresa (excepto 'users')
// Se usa cuando el wizard se ejecuta con resetMode=true
// ─────────────────────────────────────────────

async function resetEmpresaData(db, empresaId) {
    const SUBCOLLECTIONS = ['propiedades', 'tiposComponente', 'tiposElemento', 'canales', 'tarifas'];
    console.log(`[Importer] 🗑️  Iniciando reset de empresa ${empresaId}...`);

    for (const colName of SUBCOLLECTIONS) {
        const snap = await db.collection('empresas').doc(empresaId).collection(colName).get();
        if (snap.empty) continue;

        // Borrar en lotes de 400 (límite seguro de Firestore)
        const chunks = [];
        for (let i = 0; i < snap.docs.length; i += 400) chunks.push(snap.docs.slice(i, i + 400));

        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        console.log(`[Importer]   🗑️  ${colName}: ${snap.docs.length} documentos eliminados`);
    }
    console.log(`[Importer] ✅ Reset completado para empresa ${empresaId}`);
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL (CREATE OR UPDATE)
// ─────────────────────────────────────────────

async function createEmpresaFromImport(adminSdk, db, importData, credentials, wizardAnswers = {}) {
    const { email, password } = credentials;
    const { empresa, alojamientos, tiposEspacio, tiposActivo, monedaPrincipal } = importData;
    const moneda = wizardAnswers.moneda || monedaPrincipal || 'CLP';

    const result = {
        empresaId: null,
        uid: null,
        modo: null,
        canales: [],
        tiposElemento: [],
        tiposComponente: [],
        propiedades: [],
        tarifas: [],
        omitidos: [],
        errores: []
    };

    // ── PASO 1: ¿Empresa existente o nueva? ──────────────────
    console.log(`\n[Importer] 🔍 Buscando empresa con email: ${email}`);
    const existing = await findEmpresaByEmail(adminSdk, db, email);

    let empresaId, uid;

    if (existing) {
        empresaId = existing.empresaId;
        uid = existing.uid;
        result.modo = 'actualización';
        console.log(`[Importer] ♻️  Empresa existente encontrada: ${empresaId} → modo ACTUALIZACIÓN`);

        if (wizardAnswers.resetMode === true) {
            console.log(`[Importer] ⚠️  resetMode=true → borrando datos antes de reimportar...`);
            await resetEmpresaData(db, empresaId);
        }
    } else {
        result.modo = 'creación';
        console.log(`[Importer] 🆕 Creando nueva empresa: "${empresa.nombre}"`);
        try {
            const regResult = await register(adminSdk, db, {
                nombreEmpresa: empresa.nombre,
                email,
                password
            });
            empresaId = regResult.empresaId;
            uid = regResult.uid;
            console.log(`[Importer] ✅ Empresa creada: ${empresaId}`);
        } catch (err) {
            console.error(`[Importer] ❌ Error en registro:`, err.message);
            throw new Error(`No se pudo crear la empresa: ${err.message}`);
        }
    }

    result.empresaId = empresaId;
    result.uid = uid;

    // ── PASO 2: Actualizar info empresa ──────────────────────
    const empresaRef = db.collection('empresas').doc(empresaId);
    const empresaUpdate = {};
    if (empresa.nombre)    empresaUpdate.nombre = empresa.nombre;
    if (empresa.slogan)    empresaUpdate.slogan = empresa.slogan;
    if (empresa.historia)  empresaUpdate.historiaEmpresa = empresa.historia;
    if (empresa.sitioWeb)  empresaUpdate.sitioWeb = empresa.sitioWeb;
    if (empresa.email)     empresaUpdate.emailContacto = empresa.email;
    if (empresa.telefono)  empresaUpdate.telefono = empresa.telefono;
    if (empresa.direccion) empresaUpdate.direccion = empresa.direccion;
    if (empresa.ciudad)    empresaUpdate.ciudad = empresa.ciudad;
    if (Object.keys(empresaUpdate).length > 0) {
        await empresaRef.update(empresaUpdate);
        console.log(`[Importer] ✅ Info empresa actualizada`);
    }

    // ── PASO 3: Canal "Venta Directa" (upsert) ───────────────
    console.log(`[Importer] 3️⃣  Verificando canal Venta Directa...`);
    let canalDirectoId;
    try {
        const canalesExistentes = await obtenerCanalesPorEmpresa(db, empresaId);
        const canalVD = canalesExistentes.find(c =>
            normalizeKey(c.nombre).includes('venta directa') || c.esCanalPorDefecto
        );

        if (canalVD) {
            canalDirectoId = canalVD.id;
            result.omitidos.push(`Canal "${canalVD.nombre}" (ya existe)`);
            console.log(`[Importer] ⏭️  Canal Venta Directa ya existe: ${canalDirectoId}`);
        } else {
            const canal = await crearCanal(db, empresaId, {
                nombre: 'Venta Directa',
                descripcion: 'Canal de reservas directas (sitio web propio)',
                moneda,
                esCanalPorDefecto: true,
                esCanalIcal: false,
                modificadorTipo: null,
                modificadorValor: 0
            });
            canalDirectoId = canal.id;
            result.canales.push(canal);
            console.log(`[Importer] ✅ Canal creado: ${canalDirectoId}`);
        }
    } catch (err) {
        result.errores.push(`Canal Venta Directa: ${err.message}`);
        canalDirectoId = null;
    }

    // Canales OTA adicionales
    const canalesExistentes = await obtenerCanalesPorEmpresa(db, empresaId);
    const nombresExistentes = new Set(canalesExistentes.map(c => normalizeKey(c.nombre)));

    for (const nombreCanal of (wizardAnswers.canalesOTA || [])) {
        if (nombresExistentes.has(normalizeKey(nombreCanal))) {
            result.omitidos.push(`Canal "${nombreCanal}" (ya existe)`);
            continue;
        }
        try {
            const canal = await crearCanal(db, empresaId, { nombre: nombreCanal, moneda, esCanalPorDefecto: false });
            result.canales.push(canal);
            console.log(`[Importer] ✅ Canal OTA: ${nombreCanal}`);
            await sleep(200);
        } catch (err) {
            result.errores.push(`Canal ${nombreCanal}: ${err.message}`);
        }
    }

    // ── PASO 4: TiposElemento (upsert por nombre) ─────────────
    console.log(`[Importer] 4️⃣  Sincronizando ${tiposActivo.length} tipos de activo...`);

    const tiposElemExistentes = await obtenerTipos(db, empresaId);
    const tiposElemMap = new Map();

    // Indexar existentes
    for (const te of tiposElemExistentes) {
        tiposElemMap.set(normalizeKey(te.nombre), te);
    }

    const categoriasExistentes = [...new Set([
        ...tiposElemExistentes.map(t => t.categoria),
        ...tiposActivo.map(a => a.categoria)
    ].filter(Boolean))];

    for (const activo of tiposActivo) {
        const key = normalizeKey(activo.nombre);
        if (tiposElemMap.has(key)) {
            result.omitidos.push(`Activo "${activo.nombre}" (ya existe)`);
            continue;
        }
        try {
            await sleep(300);
            const metadata = await analizarMetadataActivo(activo.nombre, categoriasExistentes);
            const nuevoTipo = await crearTipoElemento(db, empresaId, {
                nombre: metadata.normalized_name || activo.nombre,
                categoria: metadata.category || activo.categoria || 'Equipamiento',
                icono: metadata.icon || '🔹',
                countable: metadata.countable || false,
                capacity: metadata.capacity || 0,
                requires_photo: metadata.requires_photo || false,
                photo_quantity: metadata.photo_quantity || 0,
                photo_guidelines: metadata.photo_guidelines || null,
                seo_tags: metadata.seo_tags || [],
                sales_context: metadata.sales_context || null,
                schema_type: metadata.schema_type || 'Thing',
                schema_property: metadata.schema_property || 'amenityFeature'
            });
            tiposElemMap.set(normalizeKey(nuevoTipo.nombre), nuevoTipo);
            tiposElemMap.set(key, nuevoTipo);
            result.tiposElemento.push(nuevoTipo);
            console.log(`[Importer]   ✅ Activo nuevo: "${nuevoTipo.nombre}"`);
        } catch (err) {
            result.errores.push(`TipoElemento "${activo.nombre}": ${err.message}`);
        }
    }

    // ── PASO 5: TiposComponente (upsert por nombreNormalizado) ─
    console.log(`[Importer] 5️⃣  Sincronizando ${tiposEspacio.length} tipos de espacio...`);

    const tiposCompExistentes = await obtenerTiposPorEmpresa(db, empresaId);
    const tiposCompMap = new Map();

    // Categorías válidas para tipos de espacio — lista estricta usada en la UI
    const CATEGORIAS_VALIDAS = new Set(['Dormitorio', 'Baño', 'Living', 'Cocina', 'Comedor', 'Terraza', 'Exterior', 'Área Común', 'Servicio', 'Otros']);
    for (const tc of tiposCompExistentes) {
        const keys = [
            normalizeKey(tc.nombreNormalizado || ''),
            normalizeKey(tc.nombreUsuario || ''),
            singularKey(tc.nombreNormalizado || ''),
            singularKey(tc.nombreUsuario || '')
        ];
        keys.filter(Boolean).forEach(k => tiposCompMap.set(k, tc));
    }

    for (const espacioNombre of tiposEspacio) {
        const key = normalizeKey(espacioNombre);
        const keyS = singularKey(espacioNombre);
        if (tiposCompMap.has(key) || tiposCompMap.has(keyS)) {
            result.omitidos.push(`Espacio "${espacioNombre}" (ya existe)`);
            continue;
        }
        try {
            await sleep(400);
            const aiData = await analizarNuevoTipoConIA(espacioNombre);
            const categoriaIA = aiData.categoria;
            const categoriaFinal = CATEGORIAS_VALIDAS.has(categoriaIA) ? categoriaIA : 'Otros';
            if (!CATEGORIAS_VALIDAS.has(categoriaIA)) console.warn(`[Importer] ⚠️  Categoría inválida de IA: "${categoriaIA}" para "${espacioNombre}" → forzado a "Otros"`);
            const nuevoTipo = await crearTipoComponente(db, empresaId, {
                nombreUsuario: espacioNombre,
                nombreNormalizado: aiData.nombreNormalizado || espacioNombre,
                categoria: categoriaFinal,
                icono: aiData.icono || '🏠',
                descripcionBase: aiData.descripcionBase || '',
                shotList: aiData.shotList || [],
                palabrasClave: aiData.palabrasClave || [],
                origen: 'importado',
                elementosDefault: aiData.inventarioSugerido || []
            });
            [key, keyS, normalizeKey(aiData.nombreNormalizado || ''), singularKey(aiData.nombreNormalizado || '')]
                .filter(Boolean).forEach(k => tiposCompMap.set(k, nuevoTipo));
            result.tiposComponente.push(nuevoTipo);
            console.log(`[Importer]   ✅ Espacio nuevo: "${nuevoTipo.nombreNormalizado}" → ${nuevoTipo.categoria}`);
        } catch (err) {
            result.errores.push(`TipoComponente "${espacioNombre}": ${err.message}`);
        }
    }

    // ── PASO 6: Propiedades (upsert por nombre) ───────────────
    console.log(`[Importer] 6️⃣  Sincronizando ${alojamientos.length} propiedades...`);

    // Cargar propiedades existentes
    const propSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
    const propExistentes = new Map();
    propSnap.forEach(doc => {
        propExistentes.set(normalizeKey(doc.data().nombre || ''), { id: doc.id, ...doc.data() });
    });

    for (const aloj of alojamientos) {
        const keyProp = normalizeKey(aloj.nombre);
        const existente = propExistentes.get(keyProp);

        if (existente) {
            // Actualizar solo campos seguros (no sobreescribir reservas ni datos manuales)
            const updateData = {};
            if (aloj.descripcionVisual || aloj.descripcion) {
                updateData['websiteData.aiDescription'] = aloj.descripcionVisual || aloj.descripcion;
            }
            // Importar fotos si la propiedad no tiene cardImage (permite re-importar si falló antes)
            const sinFotos = !existente.websiteData?.cardImage;
            if (sinFotos && (aloj.imagenesRepresentativas || []).length > 0) {
                const compExistentes = existente.componentes || [];
                const imagenesPorCompEx = distribuirImagenesPorComponente(
                    aloj.imagenesRepresentativas, compExistentes, 3, aloj.imagenesClasificadas || []
                );
                const clasificacionMapEx = buildClasificacionMap(
                    imagenesPorCompEx, aloj.imagenesClasificadas || [], compExistentes
                );
                const { websiteImages: wImgs, cardImage: cImg, totalGaleria } = await importarGaleriaPropiedad(
                    aloj.imagenesRepresentativas, clasificacionMapEx,
                    db, empresaId, existente.id, aloj, importData.empresa.nombre
                );
                if (totalGaleria > 0) {
                    updateData['websiteData.images'] = wImgs;
                    updateData['websiteData.cardImage'] = cImg;
                    console.log(`[Importer]   ✅ ${totalGaleria} foto(s) en galería para "${aloj.nombre}"`);
                }
            }
            if (aloj.precioBase > 0) updateData.precioBase = aloj.precioBase;
            if (aloj.capacidad > 0)  updateData.capacidadMaxima = aloj.capacidad;

            if (Object.keys(updateData).length > 0) {
                await db.collection('empresas').doc(empresaId)
                    .collection('propiedades').doc(existente.id)
                    .update(updateData);
            }
            result.omitidos.push(`Propiedad "${aloj.nombre}" (actualizada descripción)`);
            console.log(`[Importer]   ♻️  Propiedad actualizada: "${aloj.nombre}"`);

            // Actualizar tarifa base si hay precio
            if (aloj.precioBase > 0 && canalDirectoId) {
                await upsertTarifa(db, empresaId, existente.id, aloj.precioBase, moneda, canalDirectoId, result);
            }
            await sleep(200);
            continue;
        }

        // Crear nueva propiedad
        try {
            const componentes = buildComponentes(aloj, tiposCompMap, tiposElemMap);
            console.log(`[Importer] 🔧 "${aloj.nombre}": cap=${aloj.capacidad} dorm=${aloj.numDormitorios} baños=${aloj.numBanos} | componentes=[${componentes.map(c => c.nombreTipo || c.nombre).join(', ')}] | imgs=${aloj.imagenesRepresentativas?.length || 0}`);
            // Firestore requiere que cada amenidad sea un objeto plano (no string)
            const amenidades = (aloj.amenidades || []).map(a =>
                typeof a === 'string' ? { nombre: a } : a
            );

            const propiedad = await crearPropiedad(db, empresaId, {
                nombre: aloj.nombre,
                descripcion: aloj.descripcionVisual || aloj.descripcion || '',
                capacidadMaxima: aloj.capacidad || 2,
                numDormitorios: aloj.numDormitorios || 1,
                numBanos: aloj.numBanos || 1,
                metros: aloj.metros || 0,
                moneda,
                componentes,
                amenidades,
                estado: 'activo',
                websiteData: { aiDescription: aloj.descripcionVisual || aloj.descripcion || '', images: {}, cardImage: null }
            });

            // Distribuir imágenes clasificadas por componente (para determinar confianza)
            const imagenesPorComp = distribuirImagenesPorComponente(
                aloj.imagenesRepresentativas || [], componentes, 3, aloj.imagenesClasificadas || []
            );

            // Construir mapa de clasificación: url → { espacio, espacioId, confianza, ... }
            const clasificacionMap = buildClasificacionMap(
                imagenesPorComp, aloj.imagenesClasificadas || [], componentes
            );

            // Subir TODAS las fotos (no solo 3/comp) + crear galería en Firestore
            const { websiteImages, cardImage, totalGaleria } = await importarGaleriaPropiedad(
                aloj.imagenesRepresentativas || [], clasificacionMap,
                db, empresaId, propiedad.id, aloj, importData.empresa.nombre
            );

            if (totalGaleria > 0) {
                const autoCount = Object.values(websiteImages).flat().length;
                await db.collection('empresas').doc(empresaId)
                    .collection('propiedades').doc(propiedad.id)
                    .update({ 'websiteData.images': websiteImages, 'websiteData.cardImage': cardImage });
                console.log(`[Importer]   ✅ Galería: ${totalGaleria} fotos subidas (${autoCount} auto-asignadas, ${totalGaleria - autoCount} pendientes) para "${aloj.nombre}"`);
            }

            result.propiedades.push(propiedad);
            console.log(`[Importer]   ✅ Propiedad nueva: "${aloj.nombre}" → ${propiedad.id}`);

            if (aloj.precioBase > 0 && canalDirectoId) {
                await upsertTarifa(db, empresaId, propiedad.id, aloj.precioBase, moneda, canalDirectoId, result);
            }
            await sleep(200);
        } catch (err) {
            result.errores.push(`Propiedad "${aloj.nombre}": ${err.message}`);
            console.error(`[Importer]   ❌ Error propiedad "${aloj.nombre}":`, err.message);
        }
    }

    // ── RESUMEN ──────────────────────────────────────────────
    console.log(`\n[Importer] 🎉 Importación ${result.modo} completada:`);
    console.log(`  ID: ${result.empresaId} | Modo: ${result.modo}`);
    console.log(`  Nuevos → Canales: ${result.canales.length} | Activos: ${result.tiposElemento.length} | Espacios: ${result.tiposComponente.length} | Props: ${result.propiedades.length} | Tarifas: ${result.tarifas.length}`);
    console.log(`  Omitidos (ya existían): ${result.omitidos.length}`);
    if (result.errores.length > 0) console.warn(`  ⚠️ Errores: ${result.errores.length}`, result.errores);

    return result;
}

// ─────────────────────────────────────────────
// HELPER: Upsert tarifa (actualiza si existe, crea si no)
// ─────────────────────────────────────────────

async function upsertTarifa(db, empresaId, alojamientoId, precioBase, moneda, canalId, result) {
    try {
        const adminMod = require('firebase-admin');
        const tarifasRef = db.collection('empresas').doc(empresaId).collection('tarifas');

        // Buscar tarifa "General" existente para este alojamiento
        const snap = await tarifasRef
            .where('alojamientoId', '==', alojamientoId)
            .where('temporada', '==', 'General')
            .limit(1)
            .get();

        const año = new Date().getFullYear();
        const tarifaData = {
            alojamientoId,
            temporada: 'General',
            fechaInicio: adminMod.firestore.Timestamp.fromDate(new Date(`${año}-01-01`)),
            fechaTermino: adminMod.firestore.Timestamp.fromDate(new Date(`${año}-12-31`)),
            [`precios.${canalId}`]: precioBase,
            precioBase,
            moneda,
            fechaActualizacion: adminMod.firestore.FieldValue.serverTimestamp()
        };

        if (!snap.empty) {
            await snap.docs[0].ref.update(tarifaData);
            result.omitidos.push(`Tarifa ${alojamientoId} (actualizada)`);
        } else {
            const ref = tarifasRef.doc();
            await ref.set({
                id: ref.id,
                ...tarifaData,
                fechaCreacion: adminMod.firestore.FieldValue.serverTimestamp()
            });
            result.tarifas.push({ id: ref.id, alojamientoId });
        }
    } catch (err) {
        result.errores.push(`Tarifa "${alojamientoId}": ${err.message}`);
    }
}

module.exports = { createEmpresaFromImport };
