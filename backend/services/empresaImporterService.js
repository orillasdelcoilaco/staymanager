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

const {
    _resolverEmpresa,
    _actualizarInfoEmpresa,
    _sincronizarCanales,
    _sincronizarTiposElemento,
    _sincronizarTiposComponente,
    _sincronizarPropiedades,
    _sincronizarPlantillas,
} = require('./empresaImporterService.steps');

// ─────────────────────────────────────────────
// BUSCAR EMPRESA EXISTENTE POR EMAIL
// ─────────────────────────────────────────────

async function findEmpresaByEmail(adminSdk, db, email) {
    try {
        const userRecord = await adminSdk.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        const snapshot = await db.collectionGroup('users').where('uid', '==', uid).get();
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        const empresaId = doc.ref.parent.parent.id;
        return { empresaId, uid };
    } catch (err) {
        if (err.code === 'auth/user-not-found') return null;
        console.warn(`[Importer] findEmpresaByEmail error: ${err.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────
// RESET: borra todas las subcolecciones de la empresa (excepto 'users')
// ─────────────────────────────────────────────

async function deleteBatch(db, docs) {
    const chunks = [];
    for (let i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

async function resetEmpresaData(db, empresaId) {
    console.log(`[Importer] 🗑️  Iniciando reset de empresa ${empresaId}...`);

    const propsSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
    for (const propDoc of propsSnap.docs) {
        const galeriaSnap = await propDoc.ref.collection('galeria').get();
        if (!galeriaSnap.empty) {
            await deleteBatch(db, galeriaSnap.docs);
            console.log(`[Importer]   🗑️  galeria de "${propDoc.id}": ${galeriaSnap.docs.length} fotos eliminadas`);
        }
    }

    const SUBCOLLECTIONS = ['propiedades', 'tiposComponente', 'tiposElemento', 'canales', 'tarifas'];
    for (const colName of SUBCOLLECTIONS) {
        const snap = await db.collection('empresas').doc(empresaId).collection(colName).get();
        if (snap.empty) continue;
        await deleteBatch(db, snap.docs);
        console.log(`[Importer]   🗑️  ${colName}: ${snap.docs.length} documentos eliminados`);
    }

    console.log(`[Importer] ✅ Reset completado para empresa ${empresaId}`);
}

// ─────────────────────────────────────────────
// HELPER: Upsert tarifa (importador mágico — usa nuevo modelo)
// ─────────────────────────────────────────────

async function upsertTarifa(db, empresaId, alojamientoId, precioBase, moneda, canalId, result) {
    const { upsertTarifaImportador } = require('./tarifasService');
    await upsertTarifaImportador(empresaId, alojamientoId, precioBase, result);
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

    // Paso 1: resolver empresa (buscar existente o crear nueva)
    console.log(`\n[Importer] 🔍 Buscando empresa con email: ${email}`);
    const { empresaId, uid, modo } = await _resolverEmpresa(
        adminSdk, db, empresa, email, password, wizardAnswers,
        findEmpresaByEmail, resetEmpresaData
    );
    result.empresaId = empresaId;
    result.uid = uid;
    result.modo = modo;

    // Paso 2: actualizar info base de la empresa
    await _actualizarInfoEmpresa(db, empresaId, empresa);

    // Paso 3: sincronizar canales
    const canalDirectoId = await _sincronizarCanales(db, empresaId, moneda, wizardAnswers, result);

    // Paso 4: sincronizar tipos de activo/elemento
    const tiposElemMap = await _sincronizarTiposElemento(db, empresaId, tiposActivo, result);

    // Paso 5: sincronizar tipos de espacio/componente
    const tiposCompMap = await _sincronizarTiposComponente(db, empresaId, tiposEspacio, result);

    // Paso 6: sincronizar propiedades
    await _sincronizarPropiedades(
        db, empresaId, alojamientos, tiposCompMap, tiposElemMap,
        canalDirectoId, moneda, importData, result, upsertTarifa
    );

    // Paso 7: sincronizar tipos de plantilla y plantillas por defecto
    await _sincronizarPlantillas(db, empresaId, result);

    // Resumen
    console.log(`\n[Importer] 🎉 Importación ${result.modo} completada:`);
    console.log(`  ID: ${result.empresaId} | Modo: ${result.modo}`);
    console.log(`  Nuevos → Canales: ${result.canales.length} | Activos: ${result.tiposElemento.length} | Espacios: ${result.tiposComponente.length} | Props: ${result.propiedades.length} | Tarifas: ${result.tarifas.length}`);
    console.log(`  Omitidos (ya existían): ${result.omitidos.length}`);
    if (result.errores.length > 0) console.warn(`  ⚠️ Errores: ${result.errores.length}`, result.errores);

    return result;
}

module.exports = { createEmpresaFromImport };
