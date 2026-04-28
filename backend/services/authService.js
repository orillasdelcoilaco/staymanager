/**
 * backend/services/authService.js
 * Lógica de registro de empresa y usuario administrador inicial.
 * Firebase Auth se mantiene para autenticación — solo el storage migra a PostgreSQL.
 */
const pool = require('../db/postgres');
const createCompanyGPT = require('../ai/scripts/create-company-gpt');

function mapPgConflict(error) {
    if (error && error.code === '23505') {
        const err = new Error('Ya existe una empresa con ese nombre o subdominio.');
        err.statusCode = 409;
        return err;
    }
    return error;
}

const register = async (admin, _db, { nombreEmpresa, email, password }) => {
    const nombreNormalizado = String(nombreEmpresa || '').trim().replace(/\s+/g, ' ');
    if (!nombreNormalizado) {
        const err = new Error('El nombre de la empresa es requerido.');
        err.statusCode = 400;
        throw err;
    }

    const { rows: sameNameRows } = await pool.query(
        `SELECT id FROM empresas WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1)) LIMIT 1`,
        [nombreNormalizado]
    );
    if (sameNameRows[0]) {
        const err = new Error('Ya existe una empresa con ese nombre.');
        err.statusCode = 409;
        throw err;
    }

    // 1. Crear usuario en Firebase Authentication (se mantiene en Firebase)
    const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: email,
    });

    const empresaId = require('crypto').randomBytes(10).toString('hex').slice(0, 20);

    try {
        await pool.query(`
            INSERT INTO empresas (id, nombre, email, plan, configuracion)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            empresaId,
            nombreNormalizado,
            email,
            'premium',
            JSON.stringify({ propietarioUid: userRecord.uid })
        ]);
    } catch (error) {
        throw mapPgConflict(error);
    }

    await pool.query(`
        INSERT INTO usuarios (id, empresa_id, email, rol)
        VALUES ($1, $2, $3, $4)
    `, [userRecord.uid, empresaId, userRecord.email, 'admin']);

    console.log(`Nueva empresa "${nombreNormalizado}" y admin "${email}" creados en PostgreSQL.`);

    (async () => {
        try {
            if (typeof generateAgentForCompany === 'function') {
                await generateAgentForCompany(empresaId, nombreNormalizado);
            }
            createCompanyGPT({ id: empresaId, nombre: nombreNormalizado, plan: 'premium' });
        } catch (err) {
            console.error('No se pudo generar el agente automáticamente:', err.message);
        }
    })();

    return {
        message: 'Empresa y usuario administrador creados con éxito.',
        uid: userRecord.uid,
        email: userRecord.email,
        empresaId
    };
};

module.exports = { register };
