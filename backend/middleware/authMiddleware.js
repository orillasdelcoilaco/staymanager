const admin = require('firebase-admin');

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
        
        const usersQuery = db.collectionGroup('users').where('uid', '==', decodedToken.uid);
        const userSnapshot = await usersQuery.get();

        if (userSnapshot.empty) {
            return res.status(403).json({ error: 'Usuario no encontrado en ninguna empresa.' });
        }

        const userDoc = userSnapshot.docs[0];
        const empresaId = userDoc.ref.parent.parent.id;

        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (!empresaDoc.exists) {
            return res.status(404).json({ error: 'La empresa asociada a este usuario no fue encontrada.' });
        }
        const nombreEmpresa = empresaDoc.data().nombre;

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            empresaId: empresaId,
            rol: userDoc.data().rol,
            nombreEmpresa: nombreEmpresa
        };

        next();
    } catch (error) {
        console.error('Error al verificar el token de Firebase:', error);
        res.status(401).json({ error: 'Acceso no autorizado: Token inválido o expirado.' });
    }
};

module.exports = { createAuthMiddleware };