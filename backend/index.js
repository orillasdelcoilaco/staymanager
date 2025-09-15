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

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin SDK inicializado correctamente.');
} catch (error) {
    console.error("Error al inicializar Firebase Admin SDK:", error);
    console.error("Asegúrate de que el archivo 'serviceAccountKey.json' existe en la carpeta 'backend' para desarrollo local.");
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
    'https://staymanager-zm1j.onrender.com' // Añadido para producción
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

// --- Sirviendo el Frontend Estático (Configuración Definitiva) ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// --- Rutas de la API ---
// Rutas públicas de autenticación
app.use('/auth', authRoutes(admin, db));

// Creación de un router para las rutas privadas
const apiRouter = express.Router();

// El middleware ahora recibe 'db' además de 'admin'
const authMiddleware = createAuthMiddleware(admin, db);
apiRouter.use(authMiddleware); // <-- Guardia de seguridad para todas las rutas de /api

// Rutas de marcador de posición (ahora protegidas)
apiRouter.get('/dashboard', (req, res) => res.json({ success: true, message: `Respuesta para el Dashboard de la empresa ${req.user.empresaId}` }));
apiRouter.get('/gestion-diaria', (req, res) => res.json({ success: true, message: 'Respuesta para Gestión Diaria' }));
apiRouter.get('/calendario', (req, res) => res.json({ success: true, message: 'Respuesta para Calendario' }));
apiRouter.get('/clientes', (req, res) => res.json({ success: true, message: 'Respuesta para Clientes' }));

app.use('/api', apiRouter);

// --- Manejo de la SPA (Single-Page Application) ---
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});

