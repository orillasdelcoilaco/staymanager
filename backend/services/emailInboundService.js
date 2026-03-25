// backend/services/emailInboundService.js
// Poller IMAP centralizado: una sola bandeja, empresa identificada por +tag en el To:
// Cada empresa reenvía notificaciones de OTAs a: reviews.suitemanagers+{empresaId}@gmail.com
const { ImapFlow } = require('imapflow');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db/postgres');
const { guardarResena } = require('./resenasService');

// Dominio o nombre de marca → canal interno
const OTA_REMITENTES = {
    'booking.com':    'booking',
    'booking':        'booking',
    'airbnb.com':     'airbnb',
    'airbnb':         'airbnb',
    'expedia.com':    'expedia',
    'expedia':        'expedia',
    'vrbo.com':       'vrbo',
    'vrbo':           'vrbo',
    'tripadvisor':    'tripadvisor',
    'agoda.com':      'agoda',
    'agoda':          'agoda',
};

// Palabras clave que indican que el correo probablemente es una reseña
// Si el asunto NO contiene ninguna → se descarta sin llamar a Gemini
const KEYWORDS_RESENA = [
    'review', 'reseña', 'opinión', 'opinion', 'valoración', 'valoracion',
    'calificación', 'calificacion', 'comentario', 'feedback',
    'ha dejado', 'left a review', 'new review', 'guest review',
    'puntuación', 'puntuacion', 'rating', 'evaluación', 'evaluacion',
    'ha valorado', 'respondé', 'responde', 'tu respuesta'
];

function asuntoPareceResena(asunto) {
    const lower = (asunto || '').toLowerCase();
    return KEYWORDS_RESENA.some(kw => lower.includes(kw));
}

// Detecta canal por From header. Si es un reenvío manual, escanea también asunto y cuerpo.
function detectarCanal(from, asunto = '', cuerpo = '') {
    const fromLower = (from || '').toLowerCase();
    for (const [dominio, canal] of Object.entries(OTA_REMITENTES)) {
        if (fromLower.includes(dominio)) return canal;
    }
    // Fallback para reenvíos manuales: buscar la OTA en el contenido del correo
    const contenido = (asunto + ' ' + cuerpo.slice(0, 3000)).toLowerCase();
    for (const [dominio, canal] of Object.entries(OTA_REMITENTES)) {
        if (contenido.includes(dominio)) return canal;
    }
    return null;
}

// Extrae el empresaId del campo To: → "reviews+cv1Lb4HL@gmail.com" → "cv1Lb4HL"
function extraerEmpresaIdDelTo(toAddresses) {
    for (const addr of (toAddresses || [])) {
        const match = (addr.address || '').match(/\+([^@]+)@/);
        if (match) return match[1];
    }
    return null;
}

async function verificarEmpresa(empresaId) {
    if (!pool || !empresaId) return null;
    const { rows } = await pool.query(
        'SELECT id, nombre FROM empresas WHERE id = $1',
        [empresaId]
    );
    return rows[0] || null;
}

async function resolverPropiedadPorNombre(empresaId, nombreAlojamiento) {
    if (!pool || !nombreAlojamiento) return null;
    const { rows } = await pool.query(`
        SELECT id FROM propiedades
        WHERE empresa_id = $1 AND LOWER(nombre) LIKE LOWER($2)
        LIMIT 1
    `, [empresaId, `%${nombreAlojamiento}%`]);
    return rows[0]?.id || null;
}

async function extraerResenaConIA(asunto, cuerpo, canal) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

    const prompt = `Eres un extractor de datos de reseñas de viajeros.
Analiza el siguiente correo de notificación de ${canal} y extrae la información de la reseña.
Si el correo NO contiene una reseña (ej: confirmación de reserva, mensaje de soporte), responde indicando es_resena: false.

Asunto: ${asunto}
Cuerpo: ${cuerpo.slice(0, 3000)}

Responde SOLO con JSON válido sin markdown ni bloques de código:
{
  "es_resena": true,
  "reviewer_nombre": "nombre del huésped o null",
  "texto": "texto completo de la reseña o null",
  "rating": número normalizado del 1 al 10 o null,
  "alojamiento": "nombre del alojamiento mencionado o null",
  "fecha": "fecha ISO 8601 o null",
  "id_externo": "id único de la reseña si aparece en el correo o null"
}`;

    const result = await model.generateContent(prompt);
    const texto = result.response.text().trim().replace(/^```json\n?|\n?```$/g, '');

    try {
        return JSON.parse(texto);
    } catch {
        return null;
    }
}

async function _descargarCuerpo(imap, seq) {
    let cuerpo = '';
    try {
        const dl = await imap.download(seq, 'TEXT');
        const chunks = [];
        for await (const chunk of dl.content) chunks.push(chunk);
        cuerpo = Buffer.concat(chunks).toString('utf8').trim();
    } catch { cuerpo = ''; }

    if (cuerpo.length < 200) {
        try {
            const dl = await imap.download(seq, 'HTML');
            const chunks = [];
            for await (const chunk of dl.content) chunks.push(chunk);
            cuerpo = Buffer.concat(chunks).toString('utf8')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .slice(0, 4000);
        } catch { /* usar lo que hay */ }
    }
    return cuerpo;
}

async function _filtrarCandidatos(imap, seqs) {
    const rawMsgs = [];
    for await (const msg of imap.fetch(seqs, { envelope: true, uid: true })) {
        rawMsgs.push({
            seq: msg.seq, uid: msg.uid,
            from:   msg.envelope?.from?.[0]?.address || '',
            asunto: msg.envelope?.subject || '',
            toList: msg.envelope?.to || []
        });
    }
    const candidatos = [];
    for (const raw of rawMsgs) {
        const empresaId = extraerEmpresaIdDelTo(raw.toList);
        const empresa   = empresaId ? await verificarEmpresa(empresaId) : null;
        if (!empresa || !asuntoPareceResena(raw.asunto)) {
            await imap.messageFlagsAdd(raw.seq, ['\\Seen']);
            console.log(`[emailInbound] Omitido (seq ${raw.seq}): ${empresa ? 'asunto' : 'sin +tag'}`);
            continue;
        }
        candidatos.push({ ...raw, empresa });
    }
    return candidatos;
}

async function _procesarCandidato(imap, { seq, uid, empresa, from, asunto }) {
    const cuerpo = await _descargarCuerpo(imap, seq);
    await imap.messageFlagsAdd(seq, ['\\Seen']);

    const canal = detectarCanal(from, asunto, cuerpo);
    if (!canal) return 0;

    const datos = await extraerResenaConIA(asunto, cuerpo, canal);
    if (!datos?.es_resena) return 0;

    const propiedadId = await resolverPropiedadPorNombre(empresa.id, datos.alojamiento);
    const { nueva } = await guardarResena(empresa.id, {
        propiedadId, canal,
        idExterno:      datos.id_externo || `${canal}_${uid || seq}_${Date.now()}`,
        reviewerNombre: datos.reviewer_nombre,
        texto:          datos.texto,
        rating:         datos.rating,
        fechaReview:    datos.fecha || new Date().toISOString(),
        rawEmail:       { asunto, from, seq }
    });
    if (nueva) console.log(`[emailInbound] ✅ Nueva reseña de ${canal} para ${empresa.nombre}`);
    return nueva ? 1 : 0;
}

async function ejecutarPollResenas() {
    console.log('[emailInbound] Iniciando poll de reseñas...');
    if (!process.env.IMAP_EMAIL_USER || !process.env.IMAP_EMAIL_PASS) {
        console.log('[emailInbound] IMAP no configurado — omitiendo.'); return;
    }
    if (!process.env.GEMINI_API_KEY) {
        console.log('[emailInbound] GEMINI_API_KEY no configurada — omitiendo.'); return;
    }

    const imap = new ImapFlow({
        host: 'imap.gmail.com', port: 993, secure: true,
        auth: { user: process.env.IMAP_EMAIL_USER, pass: process.env.IMAP_EMAIL_PASS },
        logger: false
    });

    let lock = null;
    let totalNuevas = 0;
    try {
        await imap.connect();
        lock = await imap.getMailboxLock('INBOX');
        const seqs = await imap.search({ seen: false });
        if (!seqs.length) { console.log('[emailInbound] Sin correos nuevos.'); return; }
        console.log(`[emailInbound] ${seqs.length} correo(s) sin leer.`);

        const candidatos = await _filtrarCandidatos(imap, seqs);
        console.log(`[emailInbound] ${candidatos.length} candidato(s) pasan a IA.`);
        for (const c of candidatos) totalNuevas += await _procesarCandidato(imap, c);
    } catch (err) {
        console.error('[emailInbound] Error en poll:', err.message);
    } finally {
        lock?.release();
        await imap.logout().catch(() => {});
    }
    console.log(`[emailInbound] Poll completado. Nuevas reseñas: ${totalNuevas}`);
}

// Devuelve la dirección de reenvío que debe usar cada empresa
function obtenerEmailReenvio(empresaId) {
    const base  = process.env.IMAP_EMAIL_USER || 'reviews@suitemanagers.app';
    const [user, domain] = base.split('@');
    return `${user}+${empresaId}@${domain}`;
}

module.exports = { ejecutarPollResenas, obtenerEmailReenvio };
