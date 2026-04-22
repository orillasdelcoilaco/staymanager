// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Mantener por si acaso alguna referencia legacy
const path = require('path');
const aiConfig = require('../config/aiConfig');
const { AI_TASK, TASK_PROVIDER_MAP } = require('./ai/aiEnums');
const { sanitizeInput } = require('./ai/prompts/sanitizer');
const promptsProperty = require('./ai/prompts/property');
const promptsSeo = require('./ai/prompts/seo');
const { promptMetadataImagen, promptMetadataImagenConContexto } = require('./ai/prompts/image');
const { promptJsonLdYSeo } = require('./ai/prompts/jsonld');
const { withSsrCommerceObjective } = require('./ai/prompts/ssrCommerceContext');
const { getProvider } = require('./aiContentService.providers');

// Load dotenv only if not in production
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

/**
 * Genera contenido de IA para una tarea específica usando el proveedor correcto.
 * Aplica sanitización de inputs contra prompt injection antes de construir el prompt.
 *
 * @param {string} taskType — AI_TASK.* (ej: AI_TASK.SEO_GENERATION)
 * @param {string} prompt — Prompt ya construido (usar funciones de ai/prompts/)
 * @param {object} [opts]
 * @param {string} [opts.empresaId] — Para audit log de injection
 * @param {Buffer} [opts.imageBuffer] — Solo para IMAGE_METADATA
 * @returns {Promise<object|null>}
 */
async function generateForTask(taskType, prompt, opts = {}) {
    const preferredProvider = TASK_PROVIDER_MAP[taskType] || aiConfig.provider;

    // Para tareas de visión, siempre Gemini con imageBuffer
    if (taskType === AI_TASK.IMAGE_METADATA && opts.imageBuffer) {
        const gemini = getProvider('gemini');
        return gemini.generateJSON ? gemini.generateJSON(prompt, opts.imageBuffer) : null;
    }

    // Para el resto, intentar proveedor preferido de la tarea, luego cascade normal
    // aiConfig.provider siempre al final como último recurso (ej: Gemini cuando Groq falla)
    const providerChain = [preferredProvider, ...aiConfig.fallbackProviders, aiConfig.provider].filter(
        (p, i, arr) => arr.indexOf(p) === i // deduplicar
    );

    for (const providerType of providerChain) {
        try {
            const provider = getProvider(providerType);
            const result = await provider.generateJSON(prompt);
            if (result) {
                if (providerType !== preferredProvider) {
                    console.log(`[AI Task:${taskType}] ✅ Fallback exitoso con: ${providerType}`);
                }
                return result;
            }
        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.warn(`[AI Task:${taskType}] ⚠️ Cuota excedida en '${providerType}'. Intentando siguiente...`);
                continue;
            }
            if (error.code === 'AI_INJECTION_DETECTED') {
                throw error; // Nunca hacer fallback en caso de injection
            }
            throw error;
        }
    }

    console.error(`[AI Task:${taskType}] ❌ Todos los proveedores fallaron.`);
    return null;
}

/**
 * Intenta generar JSON con el proveedor principal.
 * Si falla por cuota, prueba los proveedores de fallback en orden.
 * Garantiza que una falla de cuota nunca detenga el flujo sin intentar alternativas.
 */
async function generateWithFallback(prompt) {
    const providerChain = [aiConfig.provider, ...aiConfig.fallbackProviders];

    for (const providerType of providerChain) {
        try {
            const provider = getProvider(providerType);
            const result = await provider.generateJSON(prompt);
            if (result) {
                if (providerType !== aiConfig.provider) {
                    console.log(`[AI Cascade] ✅ Éxito con proveedor fallback: ${providerType}`);
                }
                return result;
            }
        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.warn(`[AI Cascade] ⚠️ Cuota excedida en '${providerType}'. Intentando siguiente proveedor...`);
                continue;
            }
            // Error no relacionado a cuota: propagar
            throw error;
        }
    }

    console.error('[AI Cascade] ❌ Todos los proveedores fallaron o no tienen API key configurada.');
    return null;
}

const { analizarMetadataActivo: analizarMetadataActivoImpl } = require('./aiContentService.metadataActivos');
const analizarMetadataActivo = (nombreActivo, categoriasExistentes) =>
    analizarMetadataActivoImpl(nombreActivo, categoriasExistentes, { generateWithFallback, promptsProperty });

// --- LEGACY WRAPPER (To maintain backward compatibility with existing routes) ---
// Note: Ideally, all functions should be refactored to use the provider's generic methods.
// For now, we will use the provider to execute the prompts.

async function llamarIASimulada(prompt) {
    if (prompt.includes("generar metadatos SEO")) {
        return JSON.stringify({
            metaTitle: "Alojamiento Turístico | Reserva Directa",
            metaDescription: "Reserva tu estancia con la mejor tarifa garantizada."
        });
    } else if (prompt.includes("generar el contenido principal")) {
        return JSON.stringify({
            h1: "Bienvenidos a Nuestro Alojamiento",
            introParagraph: "Disfruta de una experiencia única."
        });
    } else if (prompt.includes("altText")) {
        return JSON.stringify({
            altText: "[MOCK] Vista del alojamiento (Sin IA)",
            title: "[MOCK] Foto Alojamiento",
            advertencia: null
        });
    } else if (prompt.includes("Estratega de Marca")) {
        return JSON.stringify({
            slogan: "Tu refugio ideal en la naturaleza (Simulado)",
            enfoqueMarketing: "Relax",
            palabrasClaveAdicionales: "alojamiento, turismo, descanso, naturaleza, simulado",
            tipoAlojamientoPrincipal: "Alojamiento Turístico (Simulado)",
            historiaOptimizada: "Esta es una historia optimizada simulada...",
            heroAlt: "Vista del alojamiento simulada",
            heroTitle: "Alojamiento Simulado",
            advertencia: null
        });
    }
    return "Contenido generado automáticamente (Fallback Genérico).";
}

// --- Main API Call Function (Legacy/Internal Helper) ---
async function llamarGeminiAPI(prompt, imageBuffer = null) {
    const API_KEY = aiConfig.gemini.apiKey;
    if (!API_KEY) {
        console.warn("¡ADVERTENCIA! No se encontró la GEMINI_API_KEY. Las funciones de IA usarán respuestas simuladas.");
        return llamarIASimulada(prompt);
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        // Use configured model or default to gemini-2.0-flash (Available in v1beta/recent utils)
        const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash";
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        let result;
        if (imageBuffer) {
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/webp"
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error llamando a Gemini API:", error);
        return llamarIASimulada(prompt);
    }
}

// 2. Existing Function Refactored: Generate SEO Home Page
const generarSeoHomePage = async (empresaData, contextoExtra = {}) => {
    const { historia, slogan, enfoqueMarketing, tipoAlojamientoPrincipal } = contextoExtra;
    const prompt = promptsSeo.promptSeoHomePage({
        nombreEmpresa: empresaData.nombre,
        historia: historia || '',
        slogan: slogan || '',
        enfoqueMarketing: enfoqueMarketing || '',
        tipoAlojamientoPrincipal: tipoAlojamientoPrincipal || '',
    });
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result || JSON.parse(await llamarIASimulada("generar metadatos SEO"));
};

// 3. Existing Function Refactored: Generate Home Content
const generarContenidoHomePage = async (empresaData, contextoExtra = {}) => {
    const { slogan, enfoqueMarketing, tipoAlojamientoPrincipal } = contextoExtra;
    const prompt = promptsSeo.promptContenidoHomePage({
        nombreEmpresa: empresaData.nombre,
        slogan: slogan || '',
        enfoqueMarketing: enfoqueMarketing || '',
        tipoAlojamientoPrincipal: tipoAlojamientoPrincipal || '',
    });
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result || JSON.parse(await llamarIASimulada("generar el contenido principal"));
};

/**
 * Convierte componentes de propiedad (wizard/DB) al formato esperado por promptDescripcionAlojamiento.
 * @param {object} [extra]
 * @returns {Array<{nombre: string, activos: object[]}>|null}
 */
function _espaciosConActivosDesdeExtra(extra) {
    if (!extra || !Array.isArray(extra.componentes) || extra.componentes.length === 0) return null;
    return extra.componentes.map((c) => ({
        nombre: c.nombre || c.nombreUsuario || 'Espacio',
        activos: (c.elementos || c.activos || []).map((el) => ({
            nombre: el.nombre || el.label || String(el),
            sales_context: el.sales_context,
        })),
    }));
}

// 4. Descripción comercial alojamiento (firma usada por rutas: base, nombre, marca/empresa, ciudad, tipo, estilo, extra)
const generarDescripcionAlojamiento = async (
    descripcionBase,
    nombre,
    marcaOEmpresa,
    ubicacion,
    tipo,
    estilo = 'Comercial y atractivo',
    extra = {}
) => {
    const partesServicios = [
        descripcionBase && `Descripción base: ${descripcionBase}`,
        marcaOEmpresa && `Marca o empresa: ${marcaOEmpresa}`,
        extra.historia && `Historia: ${extra.historia}`,
        extra.slogan && `Slogan: ${extra.slogan}`,
        extra.palabrasClave && `Palabras clave: ${extra.palabrasClave}`,
        extra.marketing && `Enfoque: ${extra.marketing}`,
    ].filter(Boolean);
    const servicios = partesServicios.length ? partesServicios.join('\n') : 'Detalles del alojamiento por enriquecer con inventario verificado.';

    const prompt = promptsProperty.promptDescripcionAlojamiento({
        nombre,
        tipo,
        ubicacion,
        servicios,
        estilo,
        espaciosConActivos: _espaciosConActivosDesdeExtra(extra),
    });
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result || {
        descripcion: `Bienvenido a ${nombre}, un excelente ${tipo} en ${ubicacion}. ${descripcionBase || ''}`.trim(),
        puntosFuertes: [],
    };
};

// 5. Existing Function Refactored: Generate Company Profile
// Recibe solo el texto libre del usuario (historia). Nombre y contexto ya no se usan
// desde el wizard — el texto de historia contiene toda la info necesaria.
const _INJECTION_PATTERNS = [
    /ignora\s+(las\s+)?instrucciones/i,
    /olvida\s+(todo|las instrucciones)/i,
    /\[INST\]/i,
    /###\s*(system|user|assistant)/i,
    /<\|?(system|user|assistant|im_start|im_end)\|?>/i,
    /^(system|assistant)\s*:/im,
];

const _sanitizarHistoria = (texto) => {
    if (typeof texto !== 'string') return '';
    const truncado = texto.slice(0, 2000);
    for (const pat of _INJECTION_PATTERNS) {
        if (pat.test(truncado)) throw new Error('El texto contiene patrones no permitidos.');
    }
    return truncado;
};

const generarPerfilEmpresa = async (historia, empresaContext = null) => {
    const historiaSegura = _sanitizarHistoria(historia);

    const nombre = empresaContext?.nombre || '';
    const ubicacion = [
        empresaContext?.ubicacion?.ciudad,
        empresaContext?.ubicacion?.region,
    ].filter(Boolean).join(', ');

    const contextoEmpresa = nombre ? `
DATOS DEL NEGOCIO (ya registrados en el sistema):
- Nombre: "${nombre}"
${ubicacion ? `- Ubicación: ${ubicacion}` : ''}
${empresaContext?.slogan ? `- Slogan actual: "${empresaContext.slogan}"` : ''}
` : '';

    const prompt = withSsrCommerceObjective(`Eres un Estratega de Marca especialista en turismo y alojamientos de corta estadía.
${contextoEmpresa}
DESCRIPCIÓN INGRESADA POR EL DUEÑO DEL NEGOCIO:
---
${historiaSegura}
---

REGLAS CRÍTICAS — léelas antes de generar cualquier campo:
1. PROHIBIDO generalizar instalaciones. Si la descripción menciona "hot tub", "piscina", "sauna", "gimnasio", "playa privada", "quincho" — esas palabras deben aparecer en homeIntro, homeSeoDesc y palabrasClaveAdicionales. No las conviertas en "comodidades exclusivas" ni "amenidades modernas".
2. PROHIBIDO inventar atractivos que no están en la descripción (no agregar "lago", "volcán", "montaña" si no se mencionan explícitamente).
3. El homeH1 debe ser específico del negocio — no genérico como "Cabañas en la Naturaleza".
4. El homeIntro debe mencionar al menos 2-3 instalaciones reales de la descripción.
5. El homeSeoDesc debe incluir instalaciones concretas para diferenciarse (hot tub, playa privada, etc.).
6. Si hay nombre de empresa, úsalo en el slogan o en el homeH1.

Responde SOLO con un objeto JSON (sin markdown) con estas claves exactas:
{
  "slogan": "Eslogan corto y memorable (máx 10 palabras) que refleje lo que hace único al negocio",
  "tipoAlojamientoPrincipal": "Tipo de alojamiento (ej: Cabaña, Departamento, Lodge, Complejo)",
  "enfoqueMarketing": "Uno de: Familiar, Parejas, Negocios, Aventura, Relax, Económico, Lujo, Otro",
  "palabrasClaveAdicionales": "4-6 palabras clave SEO separadas por coma — incluir instalaciones específicas mencionadas",
  "historiaOptimizada": "Reescritura del texto original optimizada para marketing (2-3 frases), conservando instalaciones específicas",
  "homeH1": "Título H1 (máx 60 caracteres) — específico, no genérico",
  "homeIntro": "Párrafo introductorio (2-3 frases) que mencione instalaciones reales: hot tub, piscina, sauna, etc. si están en la descripción",
  "homeSeoTitle": "Meta título SEO (50-60 caracteres)",
  "homeSeoDesc": "Meta descripción SEO (120-160 caracteres) con instalaciones concretas para diferenciar el negocio"
}`);

    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result;
};


// 6. Existing Function (Image Metadata)
const generarMetadataImagen = async (nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente, imageBuffer, contextoEsperado = null) => {
    const prompt = promptMetadataImagen({
        nombreEmpresa,
        nombrePropiedad,
        descripcionPropiedad,
        nombreComponente,
        tipoComponente,
        contextoEsperado: contextoEsperado ?? null,
    });

    try {
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(jsonStr);
        if (!json.altText || !json.title) throw new Error("JSON incompleto");
        return json;
    } catch (e) {
        console.warn("Fallo generación metadata imagen:", e);
        return {
            altText: `${nombreComponente} en ${nombrePropiedad}`,
            title: nombreComponente,
            advertencia: contextoEsperado ? `Error de IA verificando: ${contextoEsperado}. Intente de nuevo.` : null
        };
    }
};

// 7. Generar Estructura de Alojamiento
const generarEstructuraAlojamiento = async (descripcion, tiposDisponibles, empresaId = null) => {
    const safeDescripcion = sanitizeInput(descripcion, AI_TASK.PROPERTY_STRUCTURE, { empresaId, campo: 'descripcion' });
    const tiposInfo = tiposDisponibles.map(t => `- ${t.nombreNormalizado} (ID: ${t.id})`).join('\n');
    const prompt = promptsProperty.promptEstructuraAlojamiento({ descripcion: safeDescripcion, tiposInfo });

    try {
        const result = await generateForTask(AI_TASK.PROPERTY_STRUCTURE, prompt, { empresaId });
        return result || { componentes: [], ubicacion: {} };
    } catch (e) {
        if (e.code === 'AI_INJECTION_DETECTED') throw e;
        console.error("Error generando estructura:", e);
        return { componentes: [], ubicacion: {} };
    }
};

// 8. Evaluar Fotografías
const evaluarFotografiasConIA = async (prompt, empresaId = null) => {
    try {
        const resultado = await generateForTask(AI_TASK.IMAGE_EVALUATION, prompt, { empresaId });
        if (!resultado) return [];
        return Array.isArray(resultado) ? resultado : (resultado.requerimientos || []);
    } catch (e) {
        if (e.code === 'AI_QUOTA_EXCEEDED') {
            console.error("[CS] Critical AI Quota Error:", e.message);
            throw e;
        }
        if (e.code === 'AI_INJECTION_DETECTED') throw e;
        console.warn("Fallo evaluación de fotos IA:", e.message);
        return [];
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES CON PropertyBuildContext completo (Orquestador IA)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ESPACIOS_DESTACADOS_VENTA = 8;

/**
 * Normaliza y valida la lista de espacios destacados para venta (SSR / ficha pública).
 * Solo acepta ids reales de componentes (privado) o de áreas comunes vinculadas (comun).
 * Hasta 8 ítems: suficiente riqueza para SEO/CRO sin diluir el mensaje ni alargar en exceso la página.
 *
 * @param {unknown} raw
 * @param {Object} buildContext
 * @param {Set<string>|undefined} [allowedImagePaths] — si es un Set, solo se conserva imagen.storagePath incluida; si se omite, no se aceptan fotos (p. ej. salida de IA sin curar)
 * @returns {{ kind: 'privado'|'comun', id: string, titulo: string, pitch: string, imagen?: { storagePath: string, imageId?: string } }[]}
 */
function normalizeFirebaseStorageObjectPath(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    if (s.includes('/o/')) {
        try {
            return decodeURIComponent(s.split('/o/')[1].split('?')[0]);
        } catch (_e) {
            return s;
        }
    }
    return s;
}

/** True si candidate coincide con alguna entrada del allowlist (URL completa, path o misma ruta decodificada). */
function highlightStoragePathAllowed(set, candidate) {
    const c = String(candidate || '').trim();
    if (!c || !(set instanceof Set)) return false;
    if (set.has(c)) return true;
    const nc = normalizeFirebaseStorageObjectPath(c);
    if (nc && set.has(nc)) return true;
    for (const p of set) {
        const ps = String(p || '').trim();
        if (!ps) continue;
        if (ps === c) return true;
        if (nc && normalizeFirebaseStorageObjectPath(ps) === nc) return true;
    }
    return false;
}

function sanitizeEspaciosDestacadosVenta(raw, buildContext, allowedImagePaths) {
    const producto = buildContext?.producto || {};
    const espacios = Array.isArray(producto.espacios) ? producto.espacios : [];
    const compartidas = Array.isArray(buildContext?.compartidas) ? buildContext.compartidas : [];
    const privIds = new Set(espacios.map((e) => String(e?.id || '').trim()).filter(Boolean));
    const comIds = new Set(compartidas.map((a) => String(a?.id || '').trim()).filter(Boolean));
    const rows = Array.isArray(raw) ? raw : [];
    const out = [];
    for (let i = 0; i < rows.length && out.length < MAX_ESPACIOS_DESTACADOS_VENTA; i++) {
        const row = rows[i] || {};
        const alcance = String(row.alcance || row.scope || '').toLowerCase().trim();
        const id = String(row.id || row.componenteId || row.areaComunId || '').trim();
        const titulo = String(row.titulo || row.title || '').trim().slice(0, 90);
        const pitch = String(row.pitch || row.resumen || row.blurb || '').trim().slice(0, 220);
        if (!id || !titulo || !pitch) continue;

        const isComun = alcance === 'comun' || alcance === 'compartida' || alcance === 'común' || alcance === 'comunal';
        const isPrivado = alcance === 'privado' || alcance === 'alojamiento' || alcance === 'unidad' || alcance === '';

        const imgRaw = row.imagen || row.foto;
        let imagen;
        if (imgRaw && typeof imgRaw === 'object') {
            const storagePath = String(imgRaw.storagePath || imgRaw.storage_url || imgRaw.url || '').trim();
            const imageId = String(imgRaw.imageId || imgRaw.id || '').trim();
            if (storagePath && allowedImagePaths instanceof Set && highlightStoragePathAllowed(allowedImagePaths, storagePath)) {
                imagen = imageId ? { storagePath, imageId } : { storagePath };
            }
        } else if (typeof imgRaw === 'string' && imgRaw.trim()) {
            const storagePath = imgRaw.trim();
            if (allowedImagePaths instanceof Set && highlightStoragePathAllowed(allowedImagePaths, storagePath)) {
                imagen = { storagePath };
            }
        }

        const base = { kind: /** @type {'comun'|'privado'} */ ('privado'), id, titulo, pitch };
        if (imagen) base.imagen = imagen;

        if (isComun && comIds.has(id)) {
            base.kind = 'comun';
            out.push(base);
        } else if (isPrivado && privIds.has(id)) {
            base.kind = 'privado';
            out.push(base);
        }
    }
    return out;
}

/**
 * Subtítulo SSR bajo "Destacados para tu estadía", a partir de la lista guardada (sin inventar fuera de ella).
 *
 * @param {{ empresaNombre?: string, propiedadNombre?: string, ciudad?: string, rows: { kind?: string, titulo?: string, pitch?: string }[] }} params
 * @returns {Promise<string>}
 */
async function generarIntroDestacadosVenta(params) {
    const { empresaNombre, propiedadNombre, ciudad, rows } = params || {};
    if (!Array.isArray(rows) || !rows.length) return '';

    const bullets = rows
        .map((r) => {
            const k = r.kind === 'comun' ? 'Área común del recinto' : 'Espacio del alojamiento';
            return `- [${k}] ${String(r.titulo || '').trim()}: ${String(r.pitch || '').trim()}`;
        })
        .join('\n');

    const loc = String(ciudad || '').trim() || 'Chile';
    const prop = String(propiedadNombre || 'el alojamiento').trim();
    const emp = String(empresaNombre || '').trim();

    const prompt = withSsrCommerceObjective(`Sos redactor web para turismo en Chile. Vas a escribir UN subtítulo corto (copy de apoyo) que aparece justo debajo del título "Destacados para tu estadía" en la página pública de "${prop}" (${loc})${emp ? `, gestionado por "${emp}".` : '.'}

DATOS VERIFICADOS (no inventes nada fuera de esto):
${bullets}

REGLAS:
- Español neutro latino, tono cálido, orientado a reservar.
- Una sola frase o como máximo dos frases cortas; entre 120 y 280 caracteres en total.
- Si la lista mezcla espacios propios y áreas comunes, menciónalo de forma natural (sin jerga interna tipo "wizard" o "buildContext").
- No uses comillas tipográficas ni markdown ni viñetas en el texto final.
- No repitas literalmente el título "Destacados para tu estadía".

Responde SOLO JSON válido con esta forma exacta:
{"intro":"..."}`);

    try {
        const raw = await generateForTask(AI_TASK.PROPERTY_DESCRIPTION, prompt);
        const intro = typeof raw?.intro === 'string' ? raw.intro.replace(/\s+/g, ' ').trim() : '';
        if (intro.length < 40) return '';
        return intro.slice(0, 320);
    } catch (e) {
        console.warn('[generarIntroDestacadosVenta]', e?.message || e);
        return '';
    }
}

/**
 * Genera la narrativa comercial del alojamiento a partir del buildContext completo.
 * Reemplaza a generarDescripcionAlojamiento cuando el wizard ya completó los pasos 1-3.
 *
 * @param {Object} buildContext — PropertyBuildContext con empresa + producto
 * @returns {Promise<{descripcionComercial, puntosFuertes, uniqueSellingPoints, homeH1, homeIntro, espaciosDestacadosVenta?}>}
 */
const generarNarrativaDesdeContexto = async (buildContext) => {
    const { empresa, producto, compartidas = [] } = buildContext;

    const resumenActivos = (producto.espacios || []).map(esp => {
        const activosStr = (esp.activos || [])
            .map(a => a.sales_context || a.nombre)
            .join(', ');
        return `${esp.nombre}: ${activosStr}`;
    }).join('\n');

    const inventarioConIds = (producto.espacios || []).map((esp) => {
        const id = String(esp?.id || '').trim();
        const nm = String(esp?.nombre || '').trim();
        const act = (esp.activos || [])
            .map((a) => `${a.nombre || ''} (${String(a.sales_context || '').slice(0, 120)})`)
            .join(' | ');
        return `- id: "${id}" nombre: "${nm}" — ${act}`;
    }).join('\n');

    const areasComunesLines = (compartidas || []).length
        ? compartidas.map((a) => `- id: "${String(a?.id || '').trim()}" nombre: "${String(a?.nombre || '').trim()}"`).join('\n')
        : '(ninguna área común vinculada a esta unidad)';

    const prompt = withSsrCommerceObjective(`Actúa como Copywriter especializado en alojamientos turísticos y CRO.

Tienes el inventario COMPLETO y verificado de este alojamiento. Genera el contenido de venta.

EMPRESA: "${empresa.nombre}"
- Tipo: ${empresa.tipo || 'alojamiento turístico'}
- Enfoque: ${empresa.enfoque || 'general'}
- Slogan: "${empresa.slogan || ''}"
- Ubicación: ${empresa.ubicacion?.ciudad || ''}, ${empresa.ubicacion?.region || ''}

ALOJAMIENTO: "${producto.nombre}"
- Tipo: ${producto.tipo || 'alojamiento'}
- Capacidad: ${producto.capacidad} personas
- ${producto.numPiezas} dormitorios, ${producto.numBanos} baños

INVENTARIO VERIFICADO POR ESPACIO (resumen):
${resumenActivos}

INVENTARIO POR ESPACIO CON IDs (OBLIGATORIO para espaciosDestacadosVenta.privado):
${inventarioConIds}

ÁREAS COMUNES DEL RECINTO VINCULADAS A ESTA UNIDAD (para espaciosDestacadosVenta.comun):
${areasComunesLines}

REGLAS:
1. "descripcionComercial": texto persuasivo máx 200 palabras, orientado a conversión
2. "puntosFuertes": 3-5 bullets cortos en español, basados SOLO en lo que existe en el inventario
3. "uniqueSellingPoints": array de 3-5 frases cortas para schema.org
4. "homeH1": título principal de la landing del alojamiento. OBLIGATORIO: incluir 1-2 diferenciadores únicos reales del inventario (ej: tinaja, piscina, vista al volcán, BBQ). Máx 10 palabras. Ejemplo correcto: "Cabaña con Tinaja y Piscina en Pucón para 6 Personas". NO usar genéricos como "Cabaña en Pucón".
5. "homeIntro": 2-3 oraciones que transmitan emoción y propuesta de valor única
6. NO inventar amenidades que no estén en el inventario
7. "espaciosDestacadosVenta": array de 0 a 8 objetos para la ficha pública (tarjetas “destacados”). Prioriza calidad sobre cantidad: 4–6 suele ser ideal para conversión; usa hasta 8 solo si hay diferenciadores claros y no redundantes. Elige lo que un huésped COMPARA al decidirse (experiencia, ocio, vistas, espacios sociales, bienestar).
   Los destacados pueden ser SOLO del alojamiento, SOLO áreas comunes vinculadas, o una MEZCLA: si hay filas en "ÁREAS COMUNES DEL RECINTO VINCULADAS", conviene incluir 1-3 entradas "comun" cuando aporten valor (piscina, gimnasio del recinto, quincho compartido, zona de juegos, etc.), usando exactamente el id de esa lista.
   PROHIBIDO destacar: consumibles, aseo doméstico trivial, utensilios básicos de cocina/baño (ej. papel higiénico, pela papas, escobillas), dormitorios como “destacado” (ya van en otra sección), o inventar espacios.
   PRIORIZA cuando exista: tinaja/jacuzzi/piscina/gimnasio/zona de juegos/parrilla/quincho/vista/terraza amplia/living destacable y áreas comunes de alto valor vinculadas.
   Cada objeto EXACTAMENTE:
   { "alcance": "privado" | "comun", "id": "<id de la lista anterior, sin inventar>", "titulo": "nombre corto para el huésped", "pitch": "una frase de beneficio emocional (máx 120 caracteres)" }
   - "privado": id = uno de INVENTARIO POR ESPACIO CON IDs
   - "comun": id = uno de ÁREAS COMUNES DEL RECINTO VINCULADAS (solo si la lista no es "(ninguna...)")
   Si nada merece destacarse más allá de lo básico, devuelve [].

Responde SOLO JSON (sin markdown):
{
  "descripcionComercial": "...",
  "puntosFuertes": ["...", "..."],
  "uniqueSellingPoints": ["...", "..."],
  "homeH1": "...",
  "homeIntro": "...",
  "espaciosDestacadosVenta": []
}`);

    const raw = await generateForTask(AI_TASK.PROPERTY_DESCRIPTION, prompt);
    if (!raw) return null;
    const espaciosDestacadosVenta = sanitizeEspaciosDestacadosVenta(raw.espaciosDestacadosVenta, buildContext);
    return { ...raw, espaciosDestacadosVenta };
};

/**
 * Genera el JSON-LD schema.org + meta SEO a partir del buildContext completo.
 * Usa el prompt especializado de prompts/jsonld.js.
 *
 * @param {Object} buildContext — PropertyBuildContext con empresa + producto + narrativa
 * @returns {Promise<{metaTitle, metaDescription, keywords?: string[], jsonLd}>}
 */
const generarJsonLdDesdeContexto = async (buildContext) => {
    const prompt = promptJsonLdYSeo({ buildContext });
    return generateForTask(AI_TASK.SEO_GENERATION, prompt);
};

/**
 * Genera metadata SEO optimizada para imágenes usando contexto corporativo completo.
 * Versión mejorada de generarMetadataImagen que incluye identidad de marca.
 *
 * @param {Object} empresaContext - Contexto completo de empresa (desde getEmpresaContext)
 * @param {string} nombrePropiedad - Nombre de la propiedad/alojamiento
 * @param {string} descripcionPropiedad - Descripción de la propiedad
 * @param {string} nombreComponente - Nombre del espacio/componente fotografiado
 * @param {string} tipoComponente - Tipo/categoría del componente
 * @param {Buffer} imageBuffer - Buffer de la imagen a analizar
 * @param {string|null} contextoEsperado - Contexto específico del shot (opcional)
 * @returns {Promise<{altText: string, title: string, advertencia: string|null}>}
 */
const generarMetadataImagenConContexto = async (
    empresaContext,
    nombrePropiedad,
    descripcionPropiedad,
    nombreComponente,
    tipoComponente,
    imageBuffer,
    contextoEsperado = null
) => {
    const prompt = promptMetadataImagenConContexto({
        empresaContext,
        nombrePropiedad,
        descripcionPropiedad,
        nombreComponente,
        tipoComponente,
        contextoEsperado: contextoEsperado ?? null,
    });

    try {
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(jsonStr);
        if (!json.altText || !json.title) throw new Error("JSON incompleto");
        return json;
    } catch (e) {
        console.warn("Fallo generación metadata imagen con contexto:", e);
        // Fallback a la función original
        return generarMetadataImagen(
            empresaContext.nombre,
            nombrePropiedad,
            descripcionPropiedad,
            nombreComponente,
            tipoComponente,
            imageBuffer,
            contextoEsperado
        );
    }
};

/**
 * Genera metadata SEO para la imagen hero del sitio web de una empresa.
 * A diferencia de generarMetadataImagenConContexto (diseñada para fotos de habitaciones),
 * esta función entiende que el hero es la "cara" del negocio: analiza visualmente
 * qué muestra la imagen y lo conecta con la propuesta de valor y la identidad de la empresa.
 *
 * @param {Object} empresaContext - Contexto completo de empresa (desde getEmpresaContext)
 * @param {Buffer} imageBuffer - Buffer de la imagen hero
 * @returns {Promise<{altText: string, title: string}>}
 */
const generarMetadataHeroWeb = async (empresaContext, imageBuffer) => {
    const ubicacion = [
        empresaContext.ubicacion?.ciudad,
        empresaContext.ubicacion?.region
    ].filter(Boolean).join(', ') || 'Chile';

    const nombre = empresaContext.nombre || 'el alojamiento';
    const propuesta = empresaContext.brand?.propuestaValor
        || empresaContext.historiaOptimizada
        || empresaContext.historia
        || '';
    const enfoque = empresaContext.enfoqueMarketing || '';
    const tono = empresaContext.brand?.tonoComunicacion || 'profesional';
    const publico = empresaContext.publicoObjetivo || 'turistas';
    const tipo = empresaContext.tipoAlojamientoPrincipal || 'alojamiento turístico';

    const prompt = withSsrCommerceObjective(`
Eres un copywriter experto en SEO para turismo. Tienes dos tareas que DEBES completar en orden.

══════════════════════════════════════
PASO 1 — DESCRIBE SOLO LO QUE VES
══════════════════════════════════════
Mira la imagen y anota internamente (en "visual") qué elementos están presentes de forma CLARA Y VISIBLE.
REGLAS ESTRICTAS para este paso:
- Solo incluir lo que se ve con certeza. Si no ves un lago, no escribas lago.
- Si no ves personas, no escribas personas.
- No asumas materiales (no "madera" si no puedes confirmarlo claramente).
- No inventes contexto. Si ves agua, es "piscina" o "lago" según lo que parezca, no ambos.
- El entorno (árboles, montañas, jardín) solo si es claramente visible en la imagen.

══════════════════════════════════════
PASO 2 — ESCRIBE EL COPY DE MARKETING
══════════════════════════════════════
Con los elementos visuales reales del PASO 1, escribe metadata que conecte lo que hay en la imagen con el negocio.

NEGOCIO:
- Nombre: "${nombre}"
- Tipo: "${tipo}"
- Ubicación: ${ubicacion}
- Público objetivo: "${publico}"
- Enfoque: "${enfoque}"
- Propuesta de valor: "${propuesta}"
- Tono: "${tono}"
${empresaContext.slogan ? `- Slogan: "${empresaContext.slogan}"` : ''}

REGLAS PARA EL COPY:
- El altText DEBE incluir el nombre "${nombre}" — sin excepción
- El altText = [elemento visual real] + "en ${nombre}, ${ubicacion}" + [beneficio concreto para ${publico}]
- El title es una frase de marketing breve que use el nombre del negocio o la ubicación
- PROHIBIDO inventar elementos ausentes en la imagen para enriquecer el texto
- PROHIBIDO usar datos del negocio (lago, familia, madera) como si fueran visibles si no lo son

FORMATO DE RESPUESTA — SOLO JSON:
{
  "visual": "lista de 2-4 elementos realmente visibles en la imagen (ej: piscina, terraza, jardín, cabaña)",
  "altText": "máx 125 caracteres — elemento visual real + nombre empresa + ubicación + beneficio",
  "title": "máx 60 caracteres — frase de marketing con nombre o destino"
}
`);

    try {
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(jsonStr);
        if (!json.altText || !json.title) throw new Error('JSON incompleto');
        return { altText: json.altText, title: json.title };
    } catch (e) {
        console.warn('[generarMetadataHeroWeb] Fallo IA, usando fallback:', e.message);
        const nombreCorto = empresaContext.nombre || 'el alojamiento';
        return {
            altText: `Imagen principal de ${nombreCorto} en ${ubicacion}`,
            title: nombreCorto,
        };
    }
};

module.exports = {
    generateWithFallback,
    generateForTask,
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarMetadataImagenConContexto,
    generarMetadataHeroWeb,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa,
    generarEstructuraAlojamiento,
    evaluarFotografiasConIA,
    analizarMetadataActivo,
    generarNarrativaDesdeContexto,
    generarIntroDestacadosVenta,
    generarJsonLdDesdeContexto,
    sanitizeEspaciosDestacadosVenta,
    MAX_ESPACIOS_DESTACADOS_VENTA,
};