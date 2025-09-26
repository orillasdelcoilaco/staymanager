const admin = require('firebase-admin');

const obtenerDetallesEmpresa = async (db, empresaId) => {
    if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }

    const empresaRef = db.collection('empresas').doc(empresaId);
    const doc = await empresaRef.get();

    if (!doc.exists) {
        throw new Error('La empresa no fue encontrada.');
    }

    const empresaData = doc.data();

    return {
        nombre: empresaData.nombre,
        googleAuthStatus: !!empresaData.googleRefreshToken,
        fechaCreacion: empresaData.fechaCreacion.toDate().toLocaleDateString('es-CL')
    };
};

// --- INICIO DE LA NUEVA FUNCIÓN ---
const obtenerProximoIdNumericoCarga = async (db, empresaId) => {
    const empresaRef = db.collection('empresas').doc(empresaId);

    // Usamos una transacción para garantizar que el incremento del contador sea atómico
    // y evitar que dos cargas obtengan el mismo número al mismo tiempo.
    return db.runTransaction(async (transaction) => {
        const empresaDoc = await transaction.get(empresaRef);
        if (!empresaDoc.exists) {
            throw new Error("La empresa no existe.");
        }
        // Obtenemos el contador actual, o lo inicializamos en 0 si no existe.
        const proximoId = (empresaDoc.data().proximoIdCargaNumerico || 0) + 1;
        
        // Actualizamos el contador en la base de datos para la próxima vez.
        transaction.update(empresaRef, { proximoIdCargaNumerico: proximoId });
        
        return proximoId;
    });
};
// --- FIN DE LA NUEVA FUNCIÓN ---


module.exports = {
    obtenerDetallesEmpresa,
    obtenerProximoIdNumericoCarga // <-- Exportar la nueva función
};