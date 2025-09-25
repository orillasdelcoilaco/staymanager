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

module.exports = {
    obtenerDetallesEmpresa
};