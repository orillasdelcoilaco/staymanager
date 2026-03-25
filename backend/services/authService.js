/**
 * backend/services/authService.js
 * Lógica de registro de empresa y usuario administrador inicial.
 * Firebase Auth se mantiene para autenticación — solo el storage migra a PostgreSQL.
 */
const pool = require('../db/postgres');
const createCompanyGPT = require('../ai/scripts/create-company-gpt');

const register = async (admin, db, { nombreEmpresa, email, password }) => {
    // 1. Crear usuario en Firebase Authentication (se mantiene en Firebase)
    const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: email,
    });

    if (pool) {
        // 2a. Crear empresa en PostgreSQL usando el ID de Firestore para compatibilidad
        //     Generamos un ID string similar al de Firestore
        const empresaId = require('crypto').randomBytes(10).toString('hex').slice(0, 20);

        await pool.query(`
            INSERT INTO empresas (id, nombre, email, plan, configuracion)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            empresaId,
            nombreEmpresa,
            email,
            'premium',
            JSON.stringify({ propietarioUid: userRecord.uid })
        ]);

        // 3a. Crear usuario en PostgreSQL
        await pool.query(`
            INSERT INTO usuarios (id, empresa_id, email, rol)
            VALUES ($1, $2, $3, $4)
        `, [userRecord.uid, empresaId, userRecord.email, 'admin']);

        console.log(`Nueva empresa "${nombreEmpresa}" y admin "${email}" creados en PostgreSQL.`);

        // 4. Generar agente IA (fire-and-forget)
        (async () => {
            try {
                if (typeof generateAgentForCompany === 'function') {
                    await generateAgentForCompany(empresaId, nombreEmpresa);
                }
                createCompanyGPT({ id: empresaId, nombre: nombreEmpresa, plan: 'premium' });
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
    }

    // Firestore fallback
    const empresaRef = db.collection('empresas').doc();
    const empresaData = {
        id: empresaRef.id,
        nombre: nombreEmpresa,
        plan: 'premium',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        propietarioUid: userRecord.uid
    };
    await empresaRef.set(empresaData);

    const userRef = empresaRef.collection('users').doc(userRecord.uid);
    await userRef.set({
        email: userRecord.email,
        rol: 'admin',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        uid: userRecord.uid
    });

    console.log(`Nueva empresa "${nombreEmpresa}" y admin "${email}" creados en Firestore.`);

    (async () => {
        try {
            await generateAgentForCompany(empresaRef.id, nombreEmpresa);
            if (empresaData.plan === 'premium') createCompanyGPT(empresaData);
        } catch (err) {
            console.error('No se pudo generar el agente automáticamente:', err.message);
        }
    })();

    return {
        message: 'Empresa y usuario administrador creados con éxito.',
        uid: userRecord.uid,
        email: userRecord.email,
        empresaId: empresaRef.id
    };
};

module.exports = { register };
