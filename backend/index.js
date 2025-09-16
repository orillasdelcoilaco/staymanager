const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// --- Importar Rutas y Middlewares ---
const authRoutes = require('./routes/auth.js');
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');

// --- Carga de Credenciales y Configuración de Firebase ---
try {
    const serviceAccount = process.env.RENDER
        ? require('/etc/secrets/serviceAccountKey.json')
        : require('./serviceAccountKey.json');

    // --- LÍNEA DE DEPURACIÓN ---
    console.log(`[DEBUG] Iniciando Firebase Admin SDK para el proyecto: ${serviceAccount.project_id}`);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin SDK inicializado correctamente.');
} catch (error) {
    console.error("Error al inicializar Firebase Admin SDK:", error);
    process.exit(1);
}

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3001;

// --- Configuración de CORS ---
const allowedOrigins = [
    'https://orillasdelcoilaco.cl',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://suite-manager.onrender.com' // <-- REEMPLAZA ESTO CON TU URL
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política de CORS'));
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Rutas de la API ---
app.use('/auth', authRoutes(admin, db));

const apiRouter = express.Router();
const authMiddleware = createAuthMiddleware(admin, db);
apiRouter.use(authMiddleware);

apiRouter.get('/dashboard', (req, res) => res.json({ success: true, message: `Respuesta para el Dashboard de la empresa ${req.user.empresaId}` }));
apiRouter.get('/gestion-diaria', (req, res) => res.json({ success: true, message: 'Respuesta para Gestión Diaria' }));
apiRouter.get('/calendario', (req, res) => res.json({ success: true, message: 'Respuesta para Calendario' }));
apiRouter.get('/clientes', (req, res) => res.json({ success: true, message: 'Respuesta para Clientes' }));

app.use('/api', apiRouter);

// --- Sirviendo el Frontend Estático ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// --- Manejo de la SPA ---
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});