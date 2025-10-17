// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin'); // Importar admin aquí

// --- Importar Rutas y Middlewares --- (Mantener todas las importaciones)
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
const estadosRoutes = require('./routes/estados.js');
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');
const { createTenantResolver } = require('./middleware/tenantResolver.js');

// --- Carga de Credenciales y Configuración de Firebase ---
let db; // Declarar db aquí

console.log(`[Startup] Verificando entorno. RENDER variable: ${process.env.RENDER ? 'definida' : 'no definida'}`);

try {
    let serviceAccount;
    // ... (lógica de carga de serviceAccount se mantiene igual)
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
        console.log('[Startup] Llamando a admin.initializeApp()...');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'suite-manager-app.firebasestorage.app'
        });
        console.log(`[Startup] Firebase Admin SDK inicializado correctamente para el proyecto: ${serviceAccount.project_id}.`);
    } else {
        console.log('[Startup] Firebase Admin SDK ya estaba inicializado.');
    }

    console.log('[Startup] Intentando obtener instancia de Firestore...');
    db = admin.firestore(); // Inicializar db DESPUÉS de initializeApp()
    if (!db) {
        // Añadimos una verificación extra por si acaso.
        throw new Error('admin.firestore() devolvió undefined o null.');
    }
    console.log('[Startup] ¡Éxito! Conexión a Firestore (db) establecida.');

    // --- CREACIÓN Y CONFIGURACIÓN DE LA APP EXPRESS ---
    // **MODIFICACIÓN CLAVE**: Mover todo esto DENTRO del try, después de inicializar 'db'.
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
    const authMiddleware = createAuthMiddleware(admin, db); // Ahora 'db' está garantizado
    apiRouter.use('/auth', authRoutes(admin, db));
    apiRouter.use(authMiddleware);
    // Pasar 'db' a todas las rutas que lo necesiten
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

    // --- Iniciar el Servidor ---
    app.listen(PORT, () => {
      console.log(`[Startup] Servidor de StayManager escuchando en http://localhost:${PORT}`);
    });


} catch (error) {
    // Este catch ahora captura errores tanto de Firebase como de la configuración de Express.
    console.error("---------------------------------------------------------------");
    console.error("--- ¡ERROR CRÍTICO DURANTE LA INICIALIZACIÓN! ---");
    console.error("Detalle del error:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("La aplicación no puede continuar. Saliendo...");
    console.error("---------------------------------------------------------------");
    process.exit(1);
}