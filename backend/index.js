const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// --- Importar Rutas y Middlewares ---
const authRoutes = require('./routes/auth.js');
const propiedadesRoutes = require('./routes/propiedades.js');
const canalesRoutes = require('./routes/canales.js');
const tarifasRoutes = require('./routes/tarifas.js');
const conversionesRoutes = require('./routes/conversiones.js');
const clientesRoutes = require('./routes/clientes.js');
const reservasRoutes = require('./routes/reservas.js');
const sincronizacionRoutes = require('./routes/sincronizacion.js');
const mapeosRoutes = require('./routes/mapeos.js');
const calendarioRoutes = require('./routes/calendario.js');
const reparacionRoutes = require('./routes/reparacion.js'); // <-- AÑADIDO
const dolarRoutes = require('./routes/dolar.js'); // <-- AÑADIDO
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');

// --- Carga de Credenciales y Configuración de Firebase ---
try {
    const serviceAccount = process.env.RENDER
        ? require('/etc/secrets/serviceAccountKey.json')
        : require('./serviceAccountKey.json');

    console.log(`[DEBUG] Iniciando Firebase Admin SDK para el proyecto: ${serviceAccount.project_id}`);
    
    if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK inicializado correctamente.');
    }
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
    'https://suite-manager.onrender.com'
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
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes(admin, db));

const authMiddleware = createAuthMiddleware(admin, db);
apiRouter.use(authMiddleware); 

apiRouter.use('/propiedades', propiedadesRoutes(db));
apiRouter.use('/canales', canalesRoutes(db));
apiRouter.use('/tarifas', tarifasRoutes(db));
apiRouter.use('/conversiones', conversionesRoutes(db));
apiRouter.use('/clientes', clientesRoutes(db));
apiRouter.use('/reservas', reservasRoutes(db));
apiRouter.use('/sincronizar', sincronizacionRoutes(db));
apiRouter.use('/mapeos', mapeosRoutes(db));
apiRouter.use('/calendario', calendarioRoutes(db));
apiRouter.use('/reparar', reparacionRoutes(db)); // <-- AÑADIDO
apiRouter.use('/dolar', dolarRoutes(db)); // <-- AÑADIDO
apiRouter.get('/dashboard', (req, res) => res.json({ success: true, message: `Respuesta para el Dashboard de la empresa ${req.user.empresaId}` }));

app.use('/api', apiRouter);

// --- Sirviendo el Frontend Estático ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});