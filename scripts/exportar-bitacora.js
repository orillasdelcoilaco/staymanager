/**
 * scripts/exportar-bitacora.js
 *
 * Exporta todas las notas de gestión (gestionNotas) de todas las empresas
 * a un archivo JSON fechado. Es el único dato de reservas que no puede
 * recuperarse desde los CSV de las OTAs.
 *
 * Uso:
 *   node scripts/exportar-bitacora.js
 *   node scripts/exportar-bitacora.js --empresaId=abc123
 *
 * Salida:
 *   scripts/backups/bitacora-YYYY-MM-DD.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Inicializar Firestore ---
let serviceAccount;
if (process.env.NODE_ENV === 'production') {
    serviceAccount = require('/etc/secrets/serviceAccountKey.json');
} else {
    serviceAccount = require('../backend/serviceAccountKey.json');
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// --- Parsear argumento --empresaId ---
const args = process.argv.slice(2);
const empresaIdArg = args.find(a => a.startsWith('--empresaId='))?.split('=')[1] || null;

async function exportarBitacora() {
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(__dirname, 'backups');
    const outputFile = path.join(outputDir, `bitacora-${fechaHoy}.json`);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Obtener empresas a exportar
    let empresaIds = [];
    if (empresaIdArg) {
        empresaIds = [empresaIdArg];
        console.log(`[Bitácora] Exportando empresa: ${empresaIdArg}`);
    } else {
        const empresasSnap = await db.collection('empresas').get();
        empresaIds = empresasSnap.docs.map(d => d.id);
        console.log(`[Bitácora] Exportando ${empresaIds.length} empresa(s)...`);
    }

    const resultado = {
        exportadoEl: new Date().toISOString(),
        empresas: {}
    };

    let totalNotas = 0;

    for (const empresaId of empresaIds) {
        const notasSnap = await db
            .collection('empresas')
            .doc(empresaId)
            .collection('gestionNotas')
            .orderBy('fecha', 'desc')
            .get();

        const notas = notasSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Serializar Timestamps a ISO string
                fecha: data.fecha?.toDate?.()?.toISOString() || data.fecha || null,
                creadoEl: data.creadoEl?.toDate?.()?.toISOString() || data.creadoEl || null,
            };
        });

        resultado.empresas[empresaId] = {
            totalNotas: notas.length,
            notas
        };

        totalNotas += notas.length;
        console.log(`  ✓ ${empresaId}: ${notas.length} nota(s)`);
    }

    resultado.totalNotas = totalNotas;

    fs.writeFileSync(outputFile, JSON.stringify(resultado, null, 2), 'utf8');

    console.log(`\n[Bitácora] Exportación completa.`);
    console.log(`  Total notas: ${totalNotas}`);
    console.log(`  Archivo:     ${outputFile}`);

    process.exit(0);
}

exportarBitacora().catch(err => {
    console.error('[Bitácora] Error:', err.message);
    process.exit(1);
});
