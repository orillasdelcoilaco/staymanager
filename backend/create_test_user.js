const admin = require('firebase-admin');
const { register } = require('./services/authService');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'suite-manager-app.firebasestorage.app'
    });
}
const db = admin.firestore();

async function createTestUser() {
    const email = 'testuser@example.com';
    const password = 'password123';
    const nombreEmpresa = 'Test Company';

    try {
        // Check if user exists
        try {
            const user = await admin.auth().getUserByEmail(email);
            console.log(`User ${email} already exists with UID: ${user.uid}`);
            // If exists, we might want to find their company ID to log it, but for login we just need email/pass
            // However, ensuring the Firestore data exists is good.
            // For simplicity, if exists, we assume it's good or we can delete and recreate.
            // Let's delete and recreate to ensure clean state.
            await admin.auth().deleteUser(user.uid);
            console.log(`Deleted existing user ${email}`);
        } catch (e) {
            if (e.code !== 'auth/user-not-found') throw e;
        }

        const result = await register(admin, db, { nombreEmpresa, email, password });
        console.log('Test user created successfully:', result);

        // Create a test property
        const empresaId = result.empresaId;
        const { v4: uuidv4 } = require('uuid');

        // Ensure types exist first (reuse logic or just manually create what we need if missing, 
        // but register might not create types. Actually migrate script did that. 
        // Let's assume types might be missing for new company. 
        // We should create types too or just raw components if the frontend doesn't strictly validate types existence for display (it usually needs them for icons).

        // Let's create a simple property directly in Firestore
        const propId = uuidv4();
        await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propId).set({
            nombre: 'Cabaña de Prueba',
            direccion: 'Calle Falsa 123',
            capacidad: 4,
            componentes: [
                {
                    id: uuidv4(),
                    nombre: 'Dormitorio Principal',
                    tipo: 'DORMITORIO',
                    icono: '🛏️',
                    elementos: [
                        { nombre: 'Cama King', cantidad: 1, icono: '🛏️', amenity: 'Con vista al mar' }
                    ]
                },
                {
                    id: uuidv4(),
                    nombre: 'Baño',
                    tipo: 'BAÑO',
                    icono: '🚿',
                    elementos: [
                        { nombre: 'Ducha', cantidad: 1, icono: '🚿' }
                    ]
                }
            ],
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Test property created:', propId);

    } catch (error) {
        console.error('Error creating test user:', error);
    }
}

createTestUser();
