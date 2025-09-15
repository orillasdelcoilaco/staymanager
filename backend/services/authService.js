/**
 * Contiene la lógica de negocio para el registro y la autenticación.
 */

/**
 * Registra una nueva empresa y su primer usuario (administrador).
 * @param {object} admin - La instancia de Firebase Admin.
 * @param {object} db - La instancia de Firestore.
 * @param {object} data - Contiene { nombreEmpresa, email, password }.
 * @returns {Promise<object>} - El resultado de la operación.
 */
const register = async (admin, db, { nombreEmpresa, email, password }) => {
    // 1. Crear el usuario en Firebase Authentication
    const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: email, // Usamos el email como nombre para mostrar inicial
    });

    // 2. Crear el documento de la empresa en Firestore
    const empresaRef = db.collection('empresas').doc(); // Firestore genera un ID único
    await empresaRef.set({
        nombre: nombreEmpresa,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        propietarioUid: userRecord.uid
    });

    // 3. Crear el documento del usuario dentro de la subcolección de la empresa
    const userRef = empresaRef.collection('users').doc(userRecord.uid);
    await userRef.set({
        email: userRecord.email,
        rol: 'admin', // El primer usuario siempre es administrador
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        uid: userRecord.uid
    });

    console.log(`Nueva empresa "${nombreEmpresa}" y usuario admin "${email}" creados con éxito.`);

    return {
        message: 'Empresa y usuario administrador creados con éxito.',
        uid: userRecord.uid,
        email: userRecord.email,
        empresaId: empresaRef.id
    };
};

module.exports = {
    register
};

