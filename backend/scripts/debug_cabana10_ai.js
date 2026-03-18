/**
 * debug_cabana10_ai.js
 *
 * Diagnóstico: ¿Qué sabe la IA sobre la Cabaña 10 de Orillas del Coilaco?
 *
 * 1. Recupera la empresa y la propiedad desde Firestore.
 * 2. Muestra la estructura de datos actual (componentes, espacios, websiteData).
 * 3. Construye el contexto exacto que la IA recibiría en una consulta real.
 * 4. Pregunta: ¿cuántos dormitorios? ¿cuántos baños? ¿tiene estacionamiento?
 * 5. Analiza por qué puede o no puede responder.
 *
 * Ejecución: node backend/scripts/debug_cabana10_ai.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { generateWithFallback } = require('../services/aiContentService');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ─── COLORES para consola ───────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    bold:  '\x1b[1m',
    red:   '\x1b[31m',
    green: '\x1b[32m',
    yellow:'\x1b[33m',
    cyan:  '\x1b[36m',
    gray:  '\x1b[90m',
};
const log  = (msg)        => console.log(msg);
const ok   = (msg)        => console.log(`${C.green}✅ ${msg}${C.reset}`);
const warn = (msg)        => console.log(`${C.yellow}⚠️  ${msg}${C.reset}`);
const err  = (msg)        => console.log(`${C.red}❌ ${msg}${C.reset}`);
const head = (msg)        => console.log(`\n${C.bold}${C.cyan}${'─'.repeat(60)}\n${msg}\n${'─'.repeat(60)}${C.reset}`);

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
    head('DIAGNÓSTICO: Cabaña 10 — Orillas del Coilaco');

    // ── 1. Buscar empresa ─────────────────────────────────────────────────
    log('\n[1/5] Buscando empresa "Orillas del Coilaco"...');
    const empresasSnap = await db.collection('empresas').get();
    let empresa = null;
    empresasSnap.forEach(doc => {
        const d = doc.data();
        if ((d.nombre || '').toLowerCase().includes('coilaco')) {
            empresa = { id: doc.id, ...d };
        }
    });

    if (!empresa) { err('Empresa no encontrada. Verifica que esté importada en Firestore.'); process.exit(1); }
    ok(`Empresa encontrada: "${empresa.nombre}" (id: ${empresa.id})`);

    // ── 2. Buscar Cabaña 10 ───────────────────────────────────────────────
    log('\n[2/5] Buscando "Cabaña 10" en las propiedades...');
    const propsSnap = await db.collection('empresas').doc(empresa.id).collection('propiedades').get();
    let cabana10 = null;
    propsSnap.forEach(doc => {
        const d = doc.data();
        if ((d.nombre || '').toLowerCase().replace(/\s/g, '').includes('cabaña10') ||
            (d.nombre || '').toLowerCase().replace(/\s/g, '').includes('cabana10')) {
            cabana10 = { id: doc.id, ...d };
        }
    });

    if (!cabana10) {
        warn('Cabaña 10 no encontrada. Propiedades disponibles:');
        propsSnap.forEach(doc => log(`  - "${doc.data().nombre}" (id: ${doc.id})`));
        process.exit(1);
    }
    ok(`Propiedad encontrada: "${cabana10.nombre}" (id: ${cabana10.id})`);

    // ── 3. Mostrar estructura de datos actual ─────────────────────────────
    head('ESTRUCTURA ACTUAL EN FIRESTORE');

    log(`${C.bold}Campos principales:${C.reset}`);
    log(`  capacidad:    ${cabana10.capacidad ?? C.red + 'NO EXISTE' + C.reset}`);
    log(`  numPiezas:    ${cabana10.numPiezas  ?? C.red + 'NO EXISTE' + C.reset}`);
    log(`  numBanos:     ${cabana10.numBanos   ?? C.red + 'NO EXISTE' + C.reset}`);
    log(`  descripcion:  "${(cabana10.descripcion || '').substring(0, 100)}..."`);

    const componentes = cabana10.componentes || [];
    log(`\n${C.bold}Componentes (${componentes.length}):${C.reset}`);
    if (componentes.length === 0) {
        warn('Sin componentes. Esto significa que los espacios NO fueron asignados a esta propiedad.');
    } else {
        componentes.forEach((c, i) => {
            const elementos = (c.elementos || []).map(e => `${e.nombre}(x${e.cantidad})`).join(', ') || 'sin elementos';
            log(`  [${i+1}] tipo="${c.nombreTipo || c.tipo}" | nombre="${c.nombre}" | elementos: ${elementos}`);
        });
    }

    const websiteData = cabana10.websiteData || {};
    const images = websiteData.images || {};
    const imageCount = Object.values(images).flat().length;
    log(`\n${C.bold}websiteData:${C.reset}`);
    log(`  cardImage:     ${websiteData.cardImage?.url ? ok('existe') : C.red + 'NO existe' + C.reset}`);
    log(`  images total:  ${imageCount} imagen(es) en galería`);
    log(`  aiDescription: "${(websiteData.aiDescription || '').substring(0, 100)}"`);

    // ── 4. Construir el contexto que la IA recibiría ──────────────────────
    head('CONTEXTO QUE RECIBE LA IA (simulación)');

    const componentesTexto = componentes.length > 0
        ? componentes.map(c => {
            const els = (c.elementos || []).map(e => `${e.nombre} x${e.cantidad}`).join(', ');
            return `  - ${c.nombre} (tipo: ${c.nombreTipo || c.tipo})${els ? ': ' + els : ' — sin elementos registrados'}`;
          }).join('\n')
        : '  (ninguno — la propiedad no tiene componentes/espacios asignados)';

    const contextoSimulado = `
Propiedad: ${cabana10.nombre}
Capacidad: ${cabana10.capacidad || 'desconocida'} personas
Dormitorios declarados: ${cabana10.numPiezas || 'no registrado'}
Baños declarados: ${cabana10.numBanos || 'no registrado'}
Descripción: ${cabana10.descripcion || 'sin descripción'}

Espacios y equipamiento registrado:
${componentesTexto}
`.trim();

    log(contextoSimulado);

    // ── 5. Consulta a la IA ───────────────────────────────────────────────
    head('PREGUNTA A LA IA');

    const prompt = `Eres el asistente de la propiedad "${cabana10.nombre}" perteneciente a "${empresa.nombre}".
Tienes acceso ÚNICAMENTE a la siguiente información registrada en el sistema:

${contextoSimulado}

Responde las siguientes preguntas con exactitud, basándote SOLO en los datos anteriores.
Si la información no está disponible en los datos, di explícitamente "No tengo ese dato registrado".

Preguntas:
1. ¿Cuántos dormitorios tiene ${cabana10.nombre}?
2. ¿Cuántos baños tiene?
3. ¿Tiene estacionamiento?
4. ¿Qué espacios o ambientes tiene disponibles?

Responde de forma clara y directa.`;

    log(`${C.gray}Enviando consulta a la IA...${C.reset}`);
    try {
        const respuesta = await generateWithFallback(prompt, { returnRaw: true });
        log(`\n${C.bold}Respuesta de la IA:${C.reset}\n`);
        log(respuesta);
    } catch (e) {
        err(`Error al consultar la IA: ${e.message}`);
    }

    // ── Diagnóstico final ─────────────────────────────────────────────────
    head('DIAGNÓSTICO FINAL');

    const problemas = [];
    if (!cabana10.capacidad)            problemas.push('capacidad = 0 o null (datos numéricos no importados)');
    if (!cabana10.numPiezas)            problemas.push('numPiezas = 0 o null (dormitorios no guardados)');
    if (!cabana10.numBanos)             problemas.push('numBanos = 0 o null (baños no guardados)');
    if (componentes.length === 0)       problemas.push('sin componentes → la IA no tiene información de espacios');
    if (imageCount === 0)               problemas.push('sin imágenes en galería → no hubo input para Gemini Vision');
    if (!websiteData.aiDescription)     problemas.push('sin descripción generada por IA');
    if (componentes.length > 0) {
        const sinElementos = componentes.filter(c => !c.elementos || c.elementos.length === 0);
        if (sinElementos.length > 0) problemas.push(`${sinElementos.length} componente(s) sin elementos (inventario vacío)`);
    }

    // Verificar si hay estacionamiento
    const tieneEstacionamiento = componentes.some(c =>
        /estacion|parking|garage|garaje/i.test(c.nombre + (c.nombreTipo || ''))
    );
    if (!tieneEstacionamiento) problemas.push('estacionamiento no registrado como componente');

    if (problemas.length === 0) {
        ok('Sin problemas detectados. La IA debería poder responder correctamente.');
    } else {
        err(`Se encontraron ${problemas.length} problema(s) que impiden respuestas correctas:`);
        problemas.forEach((p, i) => log(`  ${C.red}[${i+1}]${C.reset} ${p}`));
    }

    log('');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
