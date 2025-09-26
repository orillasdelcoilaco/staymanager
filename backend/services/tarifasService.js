const admin = require('firebase-admin');

const crearTarifa = async (db, empresaId, datosTarifa) => {
    if (!empresaId || !datosTarifa.alojamientoId || !datosTarifa.temporada || !datosTarifa.fechaInicio || !datosTarifa.fechaTermino) {
        throw new Error('Faltan datos requeridos para crear la tarifa.');
    }

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc();
    
    const nuevaTarifa = {
        ...datosTarifa,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await tarifaRef.set(nuevaTarifa);
    return { id: tarifaRef.id, ...nuevaTarifa };
};

const obtenerTarifasPorEmpresa = async (db, empresaId) => {
    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas')
        .orderBy('alojamientoNombre', 'asc')
        .orderBy('fechaInicio', 'desc')
        .get();
    
    if (tarifasSnapshot.empty) {
        return [];
    }

    return tarifasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

const actualizarTarifa = async (db, empresaId, tarifaId, datosActualizados) => {
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    
    await tarifaRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: tarifaId, ...datosActualizados };
};

const eliminarTarifa = async (db, empresaId, tarifaId) => {
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    await tarifaRef.delete();
};

// --- INICIO DE LA NUEVA FUNCIÓN ---
const obtenerTarifaParaFecha = async (db, empresaId, alojamientoId, canalId, fecha) => {
    const tarifasRef = db.collection('empresas').doc(empresaId).collection('tarifas');
    const fechaDate = new Date(fecha);
    
    const q = tarifasRef
        .where('alojamientoId', '==', alojamientoId)
        .where('fechaInicio', '<=', fechaDate.toISOString().split('T')[0])
        .orderBy('fechaInicio', 'desc')
        .limit(1);

    const snapshot = await q.get();

    if (snapshot.empty) {
        return null; // No se encontró una tarifa que haya comenzado
    }

    const tarifa = snapshot.docs[0].data();

    // Validar que la fecha de la reserva esté dentro del período de la tarifa
    if (new Date(tarifa.fechaTermino) >= fechaDate) {
        return tarifa.precios[canalId] || null;
    }

    return null; // La reserva está fuera del período de la tarifa más reciente
};
// --- FIN DE LA NUEVA FUNCIÓN ---


module.exports = {
    crearTarifa,
    obtenerTarifasPorEmpresa,
    actualizarTarifa,
    eliminarTarifa,
    obtenerTarifaParaFecha
};