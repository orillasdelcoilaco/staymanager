/**
 * scripts/validar-migracion.js
 *
 * Compara conteos de registros entre Firestore y PostgreSQL.
 * Debe ejecutarse después de cada fase de migración para confirmar
 * que todos los documentos se migraron correctamente.
 *
 * Uso:
 *   node scripts/validar-migracion.js --empresaId=abc123
 *   node scripts/validar-migracion.js --empresaId=abc123 --grupo=A
 *   node scripts/validar-migracion.js --empresaId=abc123 --grupo=B
 *
 * Requiere: DATABASE_URL en .env apuntando a Supabase/PostgreSQL
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const admin = require('firebase-admin');
const { Pool } = require('pg');

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

// --- Inicializar PostgreSQL ---
if (!process.env.DATABASE_URL) {
    console.error('[Validación] ERROR: DATABASE_URL no definida. Configura la variable de entorno.');
    process.exit(1);
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- Parsear argumentos ---
const args = process.argv.slice(2);
const empresaId = args.find(a => a.startsWith('--empresaId='))?.split('=')[1];
const grupo = args.find(a => a.startsWith('--grupo='))?.split('=')[1]?.toUpperCase() || 'ALL';

if (!empresaId) {
    console.error('[Validación] ERROR: Debes especificar --empresaId=<id>');
    process.exit(1);
}

// --- Definición de colecciones a validar ---
// Grupo A: Configuración (irreemplazable)
const GRUPO_A = [
    { coleccion: 'canales',       tabla: 'canales' },
    { coleccion: 'estados',       tabla: 'estados_reserva' },
    { coleccion: 'mapeos',        tabla: 'mapeos' },
    { coleccion: 'conversiones',  tabla: 'conversiones' },
    { coleccion: 'tarifas',       tabla: 'tarifas' },
    { coleccion: 'plantillas',    tabla: 'plantillas' },
    { coleccion: 'bloqueos',      tabla: 'bloqueos' },
    { coleccion: 'icalFeeds',     tabla: 'ical_feeds' },
];

// Grupo B: Reservas (recuperable)
const GRUPO_B = [
    { coleccion: 'reservas',         tabla: 'reservas' },
    { coleccion: 'historialCargas',  tabla: 'historial_cargas' },
    { coleccion: 'transacciones',    tabla: 'transacciones' },
    { coleccion: 'gestionNotas',     tabla: 'bitacora' },
    { coleccion: 'clientes',         tabla: 'clientes' },
];

async function contarFirestore(coleccion) {
    const snap = await db
        .collection('empresas')
        .doc(empresaId)
        .collection(coleccion)
        .count()
        .get();
    return snap.data().count;
}

async function contarPostgres(tabla) {
    const { rows } = await pool.query(
        `SELECT COUNT(*) AS total FROM ${tabla} WHERE empresa_id = $1`,
        [empresaId]
    );
    return parseInt(rows[0].total, 10);
}

async function validarGrupo(nombre, colecciones) {
    console.log(`\n--- Grupo ${nombre} ---`);

    let todoOk = true;
    const resultados = [];

    for (const { coleccion, tabla } of colecciones) {
        let firestoreCount = 0;
        let postgresCount = 0;
        let estado = '';

        try {
            firestoreCount = await contarFirestore(coleccion);
        } catch (e) {
            estado = `FIRESTORE ERROR: ${e.message}`;
        }

        try {
            postgresCount = await contarPostgres(tabla);
        } catch (e) {
            estado = `POSTGRES ERROR: ${e.message}`;
        }

        if (!estado) {
            if (firestoreCount === postgresCount) {
                estado = 'OK';
            } else {
                estado = `DIFERENCIA: ${firestoreCount - postgresCount} registros faltantes`;
                todoOk = false;
            }
        } else {
            todoOk = false;
        }

        resultados.push({ coleccion, tabla, firestoreCount, postgresCount, estado });

        const icon = estado === 'OK' ? '✓' : '✗';
        console.log(`  ${icon} ${coleccion.padEnd(20)} | Firestore: ${String(firestoreCount).padStart(5)} | PostgreSQL: ${String(postgresCount).padStart(5)} | ${estado}`);
    }

    if (todoOk) {
        console.log(`\n  ✅ Grupo ${nombre}: VALIDACIÓN CORRECTA — todos los conteos coinciden.`);
    } else {
        console.log(`\n  ❌ Grupo ${nombre}: VALIDACIÓN FALLIDA — hay diferencias en los conteos.`);
    }

    return { todoOk, resultados };
}

async function main() {
    console.log(`[Validación] Empresa: ${empresaId} | Grupo: ${grupo}`);

    const resultados = {};

    if (grupo === 'A' || grupo === 'ALL') {
        resultados.A = await validarGrupo('A (Configuración)', GRUPO_A);
    }

    if (grupo === 'B' || grupo === 'ALL') {
        resultados.B = await validarGrupo('B (Reservas)', GRUPO_B);
    }

    // Propiedades — validación especial (están en subcolección o colección top-level)
    if (grupo === 'A' || grupo === 'ALL') {
        console.log('\n--- Propiedades (colección raíz) ---');
        try {
            const snap = await db.collection('propiedades')
                .where('empresaId', '==', empresaId)
                .count().get();
            const firestoreCount = snap.data().count;
            const { rows } = await pool.query(
                'SELECT COUNT(*) AS total FROM propiedades WHERE empresa_id = $1',
                [empresaId]
            );
            const postgresCount = parseInt(rows[0].total, 10);
            const ok = firestoreCount === postgresCount;
            console.log(`  ${ok ? '✓' : '✗'} propiedades           | Firestore: ${String(firestoreCount).padStart(5)} | PostgreSQL: ${String(postgresCount).padStart(5)} | ${ok ? 'OK' : `DIFERENCIA: ${firestoreCount - postgresCount}`}`);
        } catch (e) {
            console.log(`  ✗ propiedades           | ERROR: ${e.message}`);
        }
    }

    const todoOk = Object.values(resultados).every(r => r.todoOk);
    console.log('\n' + '='.repeat(60));
    if (todoOk) {
        console.log('✅ VALIDACIÓN GLOBAL: CORRECTA — puedes proceder a la siguiente fase.');
    } else {
        console.log('❌ VALIDACIÓN GLOBAL: FALLIDA — revisar diferencias antes de continuar.');
    }

    await pool.end();
    process.exit(todoOk ? 0 : 1);
}

main().catch(err => {
    console.error('[Validación] Error inesperado:', err.message);
    process.exit(1);
});
