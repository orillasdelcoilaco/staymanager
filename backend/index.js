// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin'); // Importar admin aquí

// --- Importar Rutas y Middlewares ---
// ... (todas las importaciones se mantienen igual)
const estadosRoutes = require('./routes/estados.js');
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');
const { createTenantResolver } = require('./middleware/tenantResolver.js');

// --- Carga de Credenciales y Configuración de Firebase ---
let db; // Declarar db aquí, pero no inicializarla aún

console.log(`[Startup] Verificando entorno. RENDER variable: ${process.env.RENDER ? 'definida' : 'no definida'}`);

try {
    let serviceAccount;
    if (process.env.RENDER) {
        console.log('[Startup] Entorno de Render detectado. Intentando cargar credenciales desde /etc/secrets/serviceAccountKey.json');
        serviceAccount = require('/etc/secrets/serviceAccountKey.json');
        console.log('[Startup] ¡Éxito! serviceAccountKey.json cargado desde la ruta de secretos.');
    } else {
        console.log('[Startup] Entorno local detectado. Intentando cargar credenciales desde ./serviceAccountKey.json');
        serviceAccount = require('./serviceAccountKey.json');
        console.log('[Startup] ¡Éxito! serviceAccountKey.json cargado localmente.');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'suite-manager-app.firebasestorage.app'
        });
        console.log(`[Startup] Firebase Admin SDK inicializado correctamente para el proyecto: ${serviceAccount.project_id}.`);
    }

    // **CORRECCIÓN CLAVE**: Inicializar db DESPUÉS de initializeApp()
    db = admin.firestore();
    console.log('[Startup] Conexión a Firestore establecida.');

} catch (error) {
    console.error("---------------------------------------------------------------");
    console.error("--- ¡ERROR CRÍTICO AL INICIALIZAR FIREBASE! ---");
    console.error("No se pudieron cargar o procesar las credenciales de Firebase.");
    console.error("Detalle del error:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("La aplicación no puede continuar. Saliendo...");
    console.error("---------------------------------------------------------------");
    process.exit(1); // Detiene la aplicación si Firebase no puede inicializar.
}

// Verificar si db se inicializó correctamente antes de proceder
if (!db) {
    console.error("---------------------------------------------------------------");
    console.error("--- ¡ERROR CRÍTICO! La conexión a Firestore (db) no se estableció. ---");
    console.error("Esto no debería ocurrir si la inicialización de Firebase fue exitosa.");
    console.error("Revisa los logs anteriores. Saliendo...");
    console.error("---------------------------------------------------------------");
    process.exit(1);
}


const app = express();
const PORT = process.env.PORT || 3001;

// --- Configuración Global ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cors());
app.use(express.json());

// --- ORDEN DE RUTAS ESTRATÉGICO ---

// **PRIORIDAD 1: Rutas de la API (/api/...)**
const apiRouter = express.Router();
const authMiddleware = createAuthMiddleware(admin, db); // Pasamos admin y db inicializado
apiRouter.use('/auth', authRoutes(admin, db)); // Pasamos admin y db
apiRouter.use(authMiddleware);
// Asegúrate de pasar 'db' a todas las funciones de ruta que lo necesiten
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
apiRouter.use('/estados', estadosRoutes(db));
apiRouter.get('/dashboard', (req, res) => res.json({ success: true, message: `Respuesta para el Dashboard de la empresa ${req.user.empresaId}` }));
app.use('/api', apiRouter);

// **PRIORIDAD 2: Rutas Públicas Específicas (iCal, Integraciones)**
app.use('/ical', icalRoutes(db));
app.use('/integrations', integrationsRoutes(db));

// **PRIORIDAD 3: Sirviendo Archivos Estáticos del Frontend (SPA) bajo /admin-assets**
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use('/admin-assets', express.static(frontendPath));

// **PRIORIDAD 4: Rutas del Sitio Web Público (SSR)**
const tenantResolver = createTenantResolver(db);
app.use('/', tenantResolver, (req, res, next) => {
    if (req.empresa) {
        return websiteRoutes(db)(req, res, next);
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// **PRIORIDAD 5: (Eliminada) La ruta catch-all anterior ya no es necesaria aquí.**

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});