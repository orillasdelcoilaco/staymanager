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

// --- Configuración Global ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cors()); // Se simplifica corsOptions si no es estrictamente necesario
app.use(express.json());

// --- ORDEN DE RUTAS ESTRATÉGICO ---

// **PRIORIDAD 1: Rutas de la API (/api/...)**
// Todas las peticiones que comiencen con /api serán manejadas aquí y no continuarán hacia abajo.
const apiRouter = express.Router();
const authMiddleware = createAuthMiddleware(admin, db);
apiRouter.use('/auth', authRoutes(admin, db));
apiRouter.use(authMiddleware); // Proteger todas las rutas subsiguientes
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

// **PRIORIDAD 2: Rutas Públicas Específicas (iCal, Integraciones)**
// Estas rutas no necesitan el tenantResolver y deben ser resueltas antes del sitio web.
app.use('/ical', icalRoutes(db));
app.use('/integrations', integrationsRoutes(db));

// **PRIORIDAD 3: Sirviendo Archivos Estáticos del Frontend**
// Servir CSS, JS, etc. de la SPA y del sitio SSR antes de cualquier ruta general.
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// **PRIORIDAD 4: Rutas del Sitio Web Público (SSR)**
// El tenantResolver se activa. Si encuentra una empresa, las rutas de website.js tomarán el control.
// Si no, llamará a next() y la petición continuará hacia la última ruta (el catch-all de la SPA).
const tenantResolver = createTenantResolver(db);
app.use('/', tenantResolver, websiteRoutes(db));

// **PRIORIDAD 5: Ruta "Catch-All" para la SPA (Debe ir al final de todo)**
// Si ninguna de las rutas anteriores coincidió (ni API, ni iCal, ni SSR),
// se asume que es una navegación interna de la SPA y se sirve el index.html.
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});