/**
 * scripts/migrar-empresa-config.js
 *
 * Migra la configuración base de UNA empresa desde Firestore → PostgreSQL.
 * Excluye reservas y clientes (se cargan con el importador).
 *
 * Uso:
 *   node scripts/migrar-empresa-config.js --email=orillasdelcoilaco@gmail.com
 *   node scripts/migrar-empresa-config.js --empresaId=abc123
 *
 * Idempotente: usa ON CONFLICT DO NOTHING — se puede correr múltiples veces.
 */

'use strict';

require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const admin    = require('../backend/node_modules/firebase-admin');
const { Pool } = require('../backend/node_modules/pg');
const dns      = require('dns');
dns.setDefaultResultOrder('ipv4first');

// ─── Firebase ────────────────────────────────────────────────
let serviceAccount;
try {
    serviceAccount = require('../backend/serviceAccountKey.json');
} catch {
    serviceAccount = require('/etc/secrets/serviceAccountKey.json');
}
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ─── PostgreSQL ───────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL no definida.');
    process.exit(1);
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
});

// ─── Args ─────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const emailArg  = args.find(a => a.startsWith('--email='))?.split('=')[1];
const idArg     = args.find(a => a.startsWith('--empresaId='))?.split('=')[1];

// ─── Helpers ──────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const section = (title) => console.log(`\n── ${title} ─────────────────────────`);

function toDate(val) {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val instanceof Date) return val;
    return new Date(val);
}

// ─── Crear tablas faltantes (grupo C) con TEXT ids ────────────
async function crearTablasFaltantes() {
    section('Creando tablas faltantes');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tipos_elemento (
            id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id      TEXT NOT NULL,
            nombre          TEXT NOT NULL,
            categoria       TEXT NOT NULL DEFAULT 'Otros',
            icono           TEXT DEFAULT '🔹',
            permite_cantidad  BOOLEAN DEFAULT true,
            countable         BOOLEAN DEFAULT false,
            count_value_default INTEGER DEFAULT 0,
            capacity          INTEGER DEFAULT 0,
            requires_photo    BOOLEAN DEFAULT false,
            photo_quantity    INTEGER DEFAULT 0,
            photo_guidelines  TEXT,
            seo_tags          JSONB DEFAULT '[]',
            sales_context     TEXT,
            schema_type       TEXT DEFAULT 'Thing',
            schema_property   TEXT DEFAULT 'amenityFeature',
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('tipos_elemento OK');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tipos_componente (
            id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id          TEXT NOT NULL,
            nombre_usuario      TEXT NOT NULL,
            nombre_normalizado  TEXT NOT NULL,
            categoria           TEXT NOT NULL DEFAULT 'Otros',
            icono               TEXT DEFAULT '🏠',
            descripcion_base    TEXT,
            seo_description     TEXT,
            shot_list           JSONB DEFAULT '[]',
            palabras_clave      JSONB DEFAULT '[]',
            inventario_sugerido JSONB DEFAULT '[]',
            origen              TEXT DEFAULT 'personalizado',
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('tipos_componente OK');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tipos_amenidad (
            id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id  TEXT NOT NULL,
            nombre      TEXT NOT NULL,
            icono       TEXT DEFAULT '✨',
            categoria   TEXT NOT NULL DEFAULT 'General',
            descripcion TEXT DEFAULT '',
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('tipos_amenidad OK');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS galeria (
            id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id    TEXT NOT NULL,
            propiedad_id  TEXT NOT NULL,
            original_url  TEXT,
            storage_path  TEXT,
            storage_url   TEXT,
            thumbnail_url TEXT,
            espacio       TEXT,
            espacio_id    TEXT,
            confianza     NUMERIC(3,2) DEFAULT 0.20,
            estado        TEXT NOT NULL DEFAULT 'pendiente',
            rol           TEXT NOT NULL DEFAULT 'adicional',
            alt_text      TEXT DEFAULT '',
            orden         INTEGER DEFAULT 99,
            origen        TEXT DEFAULT 'upload_manual',
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            updated_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('galeria OK');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS campanas (
            id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id      TEXT NOT NULL,
            nombre          TEXT NOT NULL,
            segmento        TEXT NOT NULL DEFAULT 'todos',
            mensaje         TEXT NOT NULL DEFAULT '',
            autor           TEXT NOT NULL DEFAULT '',
            total_enviados  INTEGER NOT NULL DEFAULT 0,
            cnt_enviado         INTEGER NOT NULL DEFAULT 0,
            cnt_respondio       INTEGER NOT NULL DEFAULT 0,
            cnt_no_interesado   INTEGER NOT NULL DEFAULT 0,
            cnt_reservo         INTEGER NOT NULL DEFAULT 0,
            cnt_sin_respuesta   INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('campanas OK');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS comunicaciones (
            id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id      TEXT NOT NULL,
            cliente_id      TEXT,
            tipo            TEXT NOT NULL DEFAULT 'email',
            evento          TEXT NOT NULL DEFAULT 'general',
            asunto          TEXT DEFAULT '',
            destinatario    TEXT DEFAULT '',
            plantilla_id    TEXT,
            relacion_tipo   TEXT,
            relacion_id     TEXT,
            estado          TEXT NOT NULL DEFAULT 'enviado',
            message_id      TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('comunicaciones OK');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS comentarios (
            id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            empresa_id          TEXT NOT NULL,
            reserva_id          TEXT,
            cliente_id          TEXT,
            cliente_nombre      TEXT NOT NULL,
            alojamiento_nombre  TEXT,
            canal_id            TEXT,
            id_reserva_canal    TEXT,
            fecha               DATE,
            comentario          TEXT NOT NULL,
            nota                NUMERIC(3,1),
            foto1_url           TEXT,
            foto2_url           TEXT,
            visible_en_web      BOOLEAN DEFAULT false,
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    log('comentarios OK');
}

// ─── Resolver empresaId ───────────────────────────────────────
async function resolverEmpresaId() {
    if (idArg) return idArg;

    if (emailArg) {
        // Buscar en PG primero
        const { rows } = await pool.query(
            'SELECT id FROM empresas WHERE email = $1 LIMIT 1',
            [emailArg]
        );
        if (rows[0]) return rows[0].id;

        // Buscar en Firestore — iterar empresas y buscar usuario con ese email
        const empresasSnap = await db.collection('empresas').get();
        for (const empDoc of empresasSnap.docs) {
            const empData = empDoc.data();
            // Primero chequear el campo email de la empresa misma
            if (empData.email === emailArg) return empDoc.id;
            // Luego buscar en la subcolección users
            const usersSnap = await db.collection('empresas').doc(empDoc.id)
                .collection('users').where('email', '==', emailArg).limit(1).get();
            if (!usersSnap.empty) return empDoc.id;
        }
    }
    throw new Error('No se encontró la empresa. Pasa --empresaId= o --email=');
}

// ─── EMPRESA ──────────────────────────────────────────────────
async function migrarEmpresa(empresaId) {
    section('Empresa');
    const doc = await db.collection('empresas').doc(empresaId).get();
    if (!doc.exists) { warn('Documento empresa no encontrado en Firestore'); return; }

    const d = doc.data();
    await pool.query(`
        INSERT INTO empresas (id, nombre, email, plan, configuracion, dominio, subdominio)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
            nombre       = EXCLUDED.nombre,
            email        = EXCLUDED.email,
            plan         = EXCLUDED.plan,
            configuracion = EXCLUDED.configuracion,
            dominio      = EXCLUDED.dominio,
            subdominio   = EXCLUDED.subdominio,
            updated_at   = NOW()
    `, [
        empresaId,
        d.nombre        || d.name || 'Sin nombre',
        d.email         || emailArg || '',
        d.plan          || 'basic',
        JSON.stringify(d.configuracion || d.config || {}),
        d.dominio       || d.domain     || null,
        d.subdominio    || d.subdomain  || null,
    ]);
    log(`Empresa: ${d.nombre || d.name}`);
}

// ─── USUARIOS ─────────────────────────────────────────────────
async function migrarUsuarios(empresaId) {
    section('Usuarios');
    const snap = await db.collection('empresas').doc(empresaId).collection('users').get();
    if (snap.empty) { warn('Sin usuarios en Firestore'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO usuarios (id, empresa_id, email, nombre, rol, activo)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.email || '', d.nombre || d.displayName || '',
            d.rol || d.role || 'admin',
            d.activo !== false,
        ]);
        count++;
    }
    log(`${count} usuarios`);
}

// ─── CANALES ──────────────────────────────────────────────────
async function migrarCanales(empresaId) {
    section('Canales');
    const snap = await db.collection('empresas').doc(empresaId).collection('canales').get();
    if (snap.empty) { warn('Sin canales'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        const { nombre, tipo, comision, activo, ...resto } = d;
        // Eliminar campos que ya tienen columna propia
        delete resto.id;
        await pool.query(`
            INSERT INTO canales (id, empresa_id, nombre, tipo, comision, activo, metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
                nombre   = EXCLUDED.nombre,
                tipo     = EXCLUDED.tipo,
                comision = EXCLUDED.comision,
                activo   = EXCLUDED.activo,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, [
            doc.id, empresaId,
            nombre || '', tipo || null,
            parseFloat(comision) || 0,
            activo !== false,
            JSON.stringify(resto),
        ]);
        count++;
    }
    log(`${count} canales`);
}

// ─── ESTADOS DE RESERVA ────────────────────────────────────────
async function migrarEstados(empresaId) {
    section('Estados de Reserva');
    const snap = await db.collection('empresas').doc(empresaId).collection('estadosReserva').get();
    if (snap.empty) { warn('Sin estados'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO estados_reserva (id, empresa_id, nombre, color, orden, es_gestion, semantica)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
                nombre     = EXCLUDED.nombre,
                color      = EXCLUDED.color,
                orden      = EXCLUDED.orden,
                es_gestion = EXCLUDED.es_gestion,
                semantica  = EXCLUDED.semantica,
                updated_at = NOW()
        `, [
            doc.id, empresaId,
            d.nombre || '', d.color || '#cccccc',
            parseInt(d.orden) || 0,
            d.esEstadoDeGestion || d.esGestion || d.es_gestion || false,
            d.semantica || null,
        ]);
        count++;
    }
    log(`${count} estados`);
}

// ─── PROPIEDADES ──────────────────────────────────────────────
async function migrarPropiedades(empresaId) {
    section('Propiedades (alojamientos)');

    // Primero desde subcollección (datos reales con IDs tipo "cabana-1")
    const subSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
    // También desde root collection (propiedades con campo empresaId)
    const rootSnap = await db.collection('propiedades').where('empresaId', '==', empresaId).get();

    const docs = [...subSnap.docs];
    // Agregar root docs que no estén ya en sub
    const subIds = new Set(subSnap.docs.map(d => d.id));
    for (const d of rootSnap.docs) {
        if (!subIds.has(d.id)) docs.push(d);
    }

    if (!docs.length) { warn('Sin propiedades'); return; }

    // Eliminar FKs de tablas relacionadas para evitar errores de orden
    await pool.query(`ALTER TABLE tarifas      DROP CONSTRAINT IF EXISTS tarifas_propiedad_id_fkey`);
    await pool.query(`ALTER TABLE conversiones DROP CONSTRAINT IF EXISTS conversiones_propiedad_id_fkey`);
    await pool.query(`ALTER TABLE bloqueos     DROP CONSTRAINT IF EXISTS bloqueos_propiedad_id_fkey`);
    await pool.query(`ALTER TABLE ical_feeds   DROP CONSTRAINT IF EXISTS ical_feeds_propiedad_id_fkey`);
    await pool.query(`ALTER TABLE galeria      DROP CONSTRAINT IF EXISTS galeria_propiedad_id_fkey`);

    let count = 0;
    for (const doc of docs) {
        const d = doc.data();
        const { nombre, capacidad, numPiezas, num_piezas, descripcion, activo, empresaId: _eid, ...resto } = d;
        delete resto.id;
        await pool.query(`
            INSERT INTO propiedades (id, empresa_id, nombre, capacidad, num_piezas, descripcion, activo, metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (id) DO UPDATE SET
                nombre      = EXCLUDED.nombre,
                capacidad   = EXCLUDED.capacidad,
                num_piezas  = EXCLUDED.num_piezas,
                descripcion = EXCLUDED.descripcion,
                activo      = EXCLUDED.activo,
                metadata    = EXCLUDED.metadata,
                updated_at  = NOW()
        `, [
            doc.id, empresaId,
            nombre || '', parseInt(capacidad) || 0,
            parseInt(numPiezas || num_piezas) || 0,
            descripcion || '',
            activo !== false,
            JSON.stringify(resto),
        ]);
        count++;
    }
    log(`${count} propiedades`);
}

// ─── TIPOS ELEMENTO ───────────────────────────────────────────
async function migrarTiposElemento(empresaId) {
    section('Tipos de Elemento');
    const snap = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();
    if (snap.empty) { warn('Sin tipos de elemento'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO tipos_elemento (id, empresa_id, nombre, categoria, icono,
                permite_cantidad, countable, count_value_default, capacity,
                requires_photo, photo_quantity, photo_guidelines,
                seo_tags, sales_context, schema_type, schema_property)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.nombre || '', d.categoria || 'Otros', d.icono || '🔹',
            d.permiteCantidad !== false,
            d.countable || false,
            d.count_value_default || 0,
            d.capacity || 0,
            d.requires_photo || false,
            d.photo_quantity || 0,
            d.photo_guidelines || null,
            JSON.stringify(d.seo_tags || []),
            d.sales_context || null,
            d.schema_type || 'Thing',
            d.schema_property || 'amenityFeature',
        ]);
        count++;
    }
    log(`${count} tipos de elemento`);
}

// ─── TIPOS COMPONENTE ─────────────────────────────────────────
async function migrarTiposComponente(empresaId) {
    section('Tipos de Componente (espacios)');
    const snap = await db.collection('empresas').doc(empresaId).collection('tiposComponente').get();
    if (snap.empty) { warn('Sin tipos de componente'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO tipos_componente (id, empresa_id, nombre_usuario, nombre_normalizado,
                categoria, icono, descripcion_base, seo_description,
                shot_list, palabras_clave, inventario_sugerido, origen)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.nombreUsuario  || d.nombreNormalizado || '',
            d.nombreNormalizado || '',
            d.categoria      || 'Otros',
            d.icono          || '🏠',
            d.descripcionBase || d.descripcion || '',
            d.seoDescription  || '',
            JSON.stringify(d.shotList     || []),
            JSON.stringify(d.palabrasClave || []),
            JSON.stringify(d.inventarioSugerido || d.elementosDefault || []),
            d.origen || 'personalizado',
        ]);
        count++;
    }
    log(`${count} tipos de componente`);
}

// ─── TIPOS AMENIDAD ───────────────────────────────────────────
async function migrarTiposAmenidad(empresaId) {
    section('Tipos de Amenidad');
    const snap = await db.collection('empresas').doc(empresaId).collection('tiposAmenidad').get();
    if (snap.empty) { warn('Sin tipos de amenidad'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO tipos_amenidad (id, empresa_id, nombre, icono, categoria, descripcion)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.nombre || '', d.icono || '✨',
            d.categoria || 'General',
            d.descripcion || '',
        ]);
        count++;
    }
    log(`${count} tipos de amenidad`);
}

// ─── MAPEOS ───────────────────────────────────────────────────
async function migrarMapeos(empresaId) {
    section('Mapeos de canales');
    const snap = await db.collection('empresas').doc(empresaId).collection('mapeosCanal').get();
    if (snap.empty) { warn('Sin mapeos'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO mapeos (id, empresa_id, canal_id, campos, mapeos_de_estado,
                formato_fecha, separador_decimal, configuracion_iva)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (empresa_id, canal_id) DO UPDATE SET
                campos            = EXCLUDED.campos,
                mapeos_de_estado  = EXCLUDED.mapeos_de_estado,
                formato_fecha     = EXCLUDED.formato_fecha,
                separador_decimal = EXCLUDED.separador_decimal,
                configuracion_iva = EXCLUDED.configuracion_iva,
                updated_at        = NOW()
        `, [
            doc.id, empresaId,
            d.canalId || d.canal_id || '',
            JSON.stringify(d.campos || d.mapeos || []),
            JSON.stringify(d.mapeosDeEstado || d.mapeos_de_estado || {}),
            d.formatoFecha      || 'DD/MM/YYYY',
            d.separadorDecimal  || ',',
            d.configuracionIva  || 'incluido',
        ]);
        count++;
    }
    log(`${count} mapeos`);
}

// ─── CONVERSIONES ─────────────────────────────────────────────
async function migrarConversiones(empresaId) {
    section('Conversiones de alojamientos');
    const snap = await db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').get();
    if (snap.empty) { warn('Sin conversiones'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO conversiones (id, empresa_id, canal_id, nombre_externo, propiedad_id)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.canalId || d.canal_id || '',
            d.nombreExterno || d.nombre_externo || '',
            d.alojamientoId || d.propiedad_id || '',
        ]);
        count++;
    }
    log(`${count} conversiones`);
}

// ─── TARIFAS ──────────────────────────────────────────────────
async function migrarTarifas(empresaId) {
    section('Tarifas');
    const snap = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
    if (snap.empty) { warn('Sin tarifas'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        const { nombre, alojamientoId, propiedad_id, activo, activa, ...reglas } = d;
        delete reglas.id;
        await pool.query(`
            INSERT INTO tarifas (id, empresa_id, propiedad_id, nombre, reglas, activa)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO UPDATE SET
                nombre      = EXCLUDED.nombre,
                reglas      = EXCLUDED.reglas,
                activa      = EXCLUDED.activa,
                updated_at  = NOW()
        `, [
            doc.id, empresaId,
            alojamientoId || propiedad_id || '',
            nombre || 'Tarifa',
            JSON.stringify(reglas),
            activa !== false && activo !== false,
        ]);
        count++;
    }
    log(`${count} tarifas`);
}

// ─── PLANTILLAS ───────────────────────────────────────────────
async function migrarPlantillas(empresaId) {
    section('Plantillas de mensajes');

    // Migrar tipos de plantilla
    const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').get();
    let countTipos = 0;
    for (const doc of tiposSnap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO tipos_plantilla (id, empresa_id, nombre, descripcion)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (id) DO NOTHING
        `, [doc.id, empresaId, d.nombre || '', d.descripcion || '']);
        countTipos++;
    }
    if (countTipos) log(`${countTipos} tipos de plantilla`);

    // Migrar plantillas de mensajes
    const plantSnap = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').get();
    let countPlant = 0;
    for (const doc of plantSnap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO plantillas (id, empresa_id, nombre, tipo, texto, activa, metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                tipo   = EXCLUDED.tipo,
                texto  = EXCLUDED.texto,
                activa = EXCLUDED.activa,
                updated_at = NOW()
        `, [
            doc.id, empresaId,
            d.nombre || '', d.tipoId || null,
            d.texto || '', d.activa !== false,
            JSON.stringify({ enviarPorEmail: d.enviarPorEmail || false, destinatarios: d.destinatarios || [] }),
        ]);
        countPlant++;
    }
    if (countPlant) log(`${countPlant} plantillas de mensajes`);
    if (!countTipos && !countPlant) warn('Sin plantillas');
}

// ─── BLOQUEOS ─────────────────────────────────────────────────
async function migrarBloqueos(empresaId) {
    section('Bloqueos de calendario');
    const snap = await db.collection('empresas').doc(empresaId).collection('bloqueos').get();
    if (snap.empty) { warn('Sin bloqueos'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO bloqueos (id, empresa_id, propiedad_id, fecha_inicio, fecha_fin,
                motivo, todos, alojamiento_ids, creado_por)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.propiedadId || d.alojamientoId || null,
            toDate(d.fechaInicio) || toDate(d.fecha_inicio),
            toDate(d.fechaFin)    || toDate(d.fecha_fin),
            d.motivo || '',
            d.todos || false,
            JSON.stringify(d.alojamientoIds || []),
            d.creadoPor || d.creado_por || null,
        ]);
        count++;
    }
    log(`${count} bloqueos`);
}

// ─── ICAL FEEDS ───────────────────────────────────────────────
async function migrarIcalFeeds(empresaId) {
    section('iCal Feeds');
    const snap = await db.collection('empresas').doc(empresaId).collection('icalFeeds').get();
    if (snap.empty) { warn('Sin ical feeds'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        await pool.query(`
            INSERT INTO ical_feeds (id, empresa_id, propiedad_id, url_ical, activo)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (id) DO NOTHING
        `, [
            doc.id, empresaId,
            d.propiedadId || d.alojamientoId || '',
            d.urlIcal || d.url || '',
            d.activo !== false,
        ]);
        count++;
    }
    log(`${count} ical feeds`);
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
    if (!emailArg && !idArg) {
        console.error('Uso: node scripts/migrar-empresa-config.js --email=xxx  o  --empresaId=xxx');
        process.exit(1);
    }

    console.log('\n🚀 Iniciando migración de configuración base...');

    const empresaId = await resolverEmpresaId();
    console.log(`\nEmpresa ID: ${empresaId}`);

    await crearTablasFaltantes();
    await migrarEmpresa(empresaId);
    await migrarUsuarios(empresaId);
    await migrarCanales(empresaId);
    await migrarEstados(empresaId);
    await migrarPropiedades(empresaId);
    await migrarTiposElemento(empresaId);
    await migrarTiposComponente(empresaId);
    await migrarTiposAmenidad(empresaId);
    await migrarMapeos(empresaId);
    await migrarConversiones(empresaId);
    await migrarTarifas(empresaId);
    await migrarPlantillas(empresaId);
    await migrarBloqueos(empresaId);
    await migrarIcalFeeds(empresaId);

    console.log('\n✅ Migración completada.\n');
    await pool.end();
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    pool.end();
    process.exit(1);
});
