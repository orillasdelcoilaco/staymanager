// backend/index.js
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
const reparacionRoutes = require('./routes/reparacion.js');
const dolarRoutes = require('./routes/dolar.js');
const authGoogleRoutes = require('./routes/authGoogle.js');
const empresaRoutes = require('./routes/empresa.js');
const usuariosRoutes = require('./routes/usuarios.js');
const gestionRoutes = require('./routes/gestion.js');
const historialCargasRoutes = require('./routes/historialCargas.js');
const plantillasRoutes = require('./routes/plantillas.js');
const mensajesRoutes = require('./routes/mensajes.js');
const propuestasRoutes = require('./routes/propuestas.js');
const presupuestosRoutes = require('./routes/presupuestos.js');
const gestionPropuestasRoutes = require('./routes/gestionPropuestas.js');
const reportesRoutes = require('./routes/reportes.js');
const kpiRoutes = require('./routes/kpi.js');
const icalRoutes = require('./routes/ical.js');
const crmRoutes = require('./routes/crm.js');
const websiteRoutes = require('./routes/website.js');
const integrationsRoutes = require('./routes/integrations.js');
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');
const { createTenantResolver } = require('./middleware/tenantResolver.js');

// --- Carga de Credenciales y Configuración de Firebase ---
try {
    const serviceAccount = process.env.RENDER
        ? require('/etc/secrets/serviceAccountKey.json')
        : require('./serviceAccountKey.json');

    console.log(`[DEBUG] Iniciando Firebase Admin SDK para el proyecto: ${serviceAccount.project_id}`);
    
    if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'suite-manager-app.firebasestorage.app' 
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

// --- Configuración del Motor de Vistas (EJS) para SSR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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


// --- ORDEN DE RUTAS CORREGIDO ---

// 1. Rutas de API (Privadas) - Las más específicas primero
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
apiRouter.use('/reparar', reparacionRoutes(db));
apiRouter.use('/dolar', dolarRoutes(db));
apiRouter.use('/auth/google', authGoogleRoutes(db));
apiRouter.use('/empresa', empresaRoutes(db));
apiRouter.use('/usuarios', usuariosRoutes(db));
apiRouter.use('/gestion', gestionRoutes(db));
apiRouter.use('/historial-cargas', historialCargasRoutes(db));
apiRouter.use('/plantillas', plantillasRoutes(db));
apiRouter.use('/mensajes', mensajesRoutes(db));
apiRouter.use('/propuestas', propuestasRoutes(db));
apiRouter.use('/presupuestos', presupuestosRoutes(db));
apiRouter.use('/gestion-propuestas', gestionPropuestasRoutes(db));
apiRouter.use('/reportes', reportesRoutes(db));
apiRouter.use('/kpis', kpiRoutes(db));
apiRouter.use('/crm', crmRoutes(db)); 
apiRouter.get('/dashboard', (req, res) => res.json({ success: true, message: `Respuesta para el Dashboard de la empresa ${req.user.empresaId}` }));
app.use('/api', apiRouter);

// 2. Otras Rutas Públicas Específicas
app.use('/ical', icalRoutes(db));
app.use('/integrations', integrationsRoutes(db));

// 3. Rutas del Sitio Web Público (SSR)
const tenantResolver = createTenantResolver(db);
app.use('/', tenantResolver, websiteRoutes(db));

// 4. Sirviendo el Frontend Estático (SPA)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// 5. Ruta "Catch-All" para la SPA (Debe ir al final)
app.get('*', (req, res) => {
    if (!req.empresa) {
        res.sendFile(path.join(frontendPath, 'index.html'));
    }
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});