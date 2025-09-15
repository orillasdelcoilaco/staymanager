const admin = require('firebase-admin');

const createAuthMiddleware = (admin, db) => async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado.' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Buscar el usuario en la subcolección 'users' de su empresa
        const usersQuery = db.collectionGroup('users').where('uid', '==', decodedToken.uid);
        const userSnapshot = await usersQuery.get();

        if (userSnapshot.empty) {
            return res.status(403).json({ error: 'Usuario no encontrado en ninguna empresa.' });
        }

        // Asumimos que un usuario solo puede pertenecer a una empresa por ahora
        const userDoc = userSnapshot.docs[0];
        const empresaId = userDoc.ref.parent.parent.id; // Navega dos niveles hacia arriba para obtener el ID de la empresa

        // Adjuntamos la información clave a la solicitud para uso posterior
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            empresaId: empresaId,
            rol: userDoc.data().rol
        };

        next();
    } catch (error) {
        console.error('Error al verificar el token de Firebase:', error);
        res.status(401).json({ error: 'Acceso no autorizado: Token inválido o expirado.' });
    }
};

module.exports = { createAuthMiddleware };

