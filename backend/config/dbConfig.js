// backend/config/dbConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// INTERRUPTOR CENTRALIZADO DE BASE DE DATOS
//
// Para cambiar el motor de base de datos en todo el proyecto, definir:
//   DB_MODE=postgres   → PostgreSQL/Supabase (requiere DATABASE_URL)
//   DB_MODE=firestore  → Firestore (legacy)
//
// Si DB_MODE no está definida, se detecta automáticamente:
//   - DATABASE_URL presente  → postgres
//   - DATABASE_URL ausente   → firestore
// ─────────────────────────────────────────────────────────────────────────────

const DB_MODE = process.env.DB_MODE
    || (process.env.DATABASE_URL ? 'postgres' : 'firestore');

if (!['postgres', 'firestore'].includes(DB_MODE)) {
    throw new Error(`[dbConfig] DB_MODE inválido: "${DB_MODE}". Valores aceptados: "postgres" | "firestore".`);
}

if (DB_MODE === 'postgres' && !process.env.DATABASE_URL) {
    throw new Error('[dbConfig] DB_MODE=postgres pero DATABASE_URL no está definida. Agrega DATABASE_URL al entorno.');
}

const IS_POSTGRES  = DB_MODE === 'postgres';
const IS_FIRESTORE = DB_MODE === 'firestore';

if (IS_POSTGRES)  console.log('[dbConfig] Motor activo: PostgreSQL');
if (IS_FIRESTORE) console.log('[dbConfig] Motor activo: Firestore (legacy)');

module.exports = { DB_MODE, IS_POSTGRES, IS_FIRESTORE };
