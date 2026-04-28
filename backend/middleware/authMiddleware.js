const admin = require('firebase-admin');
const pool = require('../db/postgres');

async function resolveEmpresaFromPostgres(uid) {
    if (!pool) return null;
    const { rows } = await pool.query(
        `SELECT u.empresa_id, u.rol, e.nombre
         FROM usuarios u
         JOIN empresas e ON e.id = u.empresa_id
         WHERE u.id = $1
         LIMIT 1`,
        [uid]
    );
    if (!rows[0]) return null;
    return {
        empresaId: rows[0].empresa_id,
        rol: rows[0].rol,
        nombreEmpresa: rows[0].nombre,
    };
}

const createAuthMiddleware = (admin, db) => async (req, res, next) => {
    if (req.path === '/auth/google/callback') {
        return next();
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado.' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        if (!pool) {
            return res.status(500).json({ error: 'PostgreSQL no está activo para resolver identidad de empresa.' });
        }

        const pgIdentity = await resolveEmpresaFromPostgres(decodedToken.uid);
        if (!pgIdentity) {
            return res.status(403).json({ error: 'Usuario no encontrado en PostgreSQL.' });
        }

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            empresaId: pgIdentity.empresaId,
            rol: pgIdentity.rol || 'admin',
            nombreEmpresa: pgIdentity.nombreEmpresa || '',
        };

        next();
    } catch (error) {
        console.error('Error al verificar el token de Firebase:', error);
        res.status(401).json({ error: 'Acceso no autorizado: Token inválido o expirado.' });
    }
};

module.exports = { createAuthMiddleware };