// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

// --- Importar Rutas y Middlewares ---
// (Mantener todas las importaciones existentes...)
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
const comunicacionesRoutes = require('./routes/comunicaciones.js');
const estadosRoutes = require('./routes/estados.js');
const websiteConfigRoutes = require('./routes/websiteConfigRoutes.js');
// --- INICIO DE LA MODIFICACIÓN (Importar nueva ruta) ---
const comentariosRoutes = require('./routes/comentarios.js');
// --- FIN DE LA MODIFICACIÓN ---
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');
const { createTenantResolver } = require('./middleware/tenantResolver.js');

// --- Carga de Credenciales y Configuración de Firebase ---
let db;
console.log(`[Startup] Verificando entorno. RENDER variable: ${process.env.RENDER ? 'definida' : 'no definida'}`);
try {
    let serviceAccount;
    if (process.env.RENDER) {
        serviceAccount = require('/etc/secrets/serviceAccountKey.json');
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }
    if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'suite-manager-app.firebasestorage.app' // VERIFICA QUE ESTE SEA EL CORRECTO
        });
    }
    db = admin.firestore();
    console.log('[Startup] ¡Éxito! Conexión a Firestore (db) establecida.');

    // --- CREACIÓN Y CONFIGURACIÓN DE LA APP EXPRESS ---
    const app = express();
    const PORT = process.env.PORT || 3001;
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(cors());
    app.use(express.json());

    // --- ORDEN DE RUTAS ESTRATÉGICO ---


    // **PRIORIDAD 1: Rutas de la API (/api/...)**
    const apiRouter = express.Router();
    const authMiddleware = createAuthMiddleware(admin, db);

    apiRouter.use('/auth', authRoutes(admin, db));
    apiRouter.use(authMiddleware);
    // ... (registro de todas las rutas API como estaban)
    apiRouter.use('/propiedades', propiedadesRoutes(db));
    apiRouter.use('/comunicaciones', comunicacionesRoutes(db));
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
    apiRouter.use('/website-config', websiteConfigRoutes(db));
    // --- INICIO DE LA MODIFICACIÓN (Montar nueva ruta) ---
    apiRouter.use('/comentarios', comentariosRoutes(db));

    // --- FIN DE LA MODIFICACIÓN ---
    apiRouter.get('/dashboard', (req, res) => res.json({ success: true, message: `Respuesta para el Dashboard de la empresa ${req.user.empresaId}` }));
    app.use('/api', apiRouter);


    // **PRIORIDAD 2: Rutas Públicas Específicas (iCal, Integraciones)**
    app.use('/ical', icalRoutes(db));
    app.use('/integrations', integrationsRoutes(db));

    // **PRIORIDAD 3: Sirviendo Archivos Estáticos del Frontend (SPA) bajo /admin-assets**
    const frontendPath = path.join(__dirname, '..', 'frontend');
    app.use('/admin-assets', express.static(frontendPath));

    // **PRIORIDAD 4: Sirviendo Archivos Estáticos del Sitio Público (SSR) bajo /public**
    // <-- CAMBIO AQUÍ: Servir desde backend/public
    const backendPublicPath = path.join(__dirname, 'public');
    app.use('/public', express.static(backendPublicPath));

    // **PRIORIDAD 5: Rutas del Sitio Web Público (SSR)**
    const tenantResolver = createTenantResolver(db);
    app.use('/', tenantResolver, (req, res, next) => {
        if (req.empresa) {
            // Si hay empresa, pasamos al router del sitio público
            return websiteRoutes(db)(req, res, next);
        }
        // Si no hay empresa (dominio no coincide), servimos la SPA de administración
        res.sendFile(path.join(frontendPath, 'index.html'));
    });

    // --- Iniciar el Servidor ---
    app.listen(PORT, () => {
      console.log(`[Startup] Servidor de StayManager escuchando en http://localhost:${PORT}`);
   });

} catch (error) {
    console.error("--- ¡ERROR CRÍTICO DURANTE LA INICIALIZACIÓN! ---");
    console.error("Detalle del error:", error.message);
    process.exit(1);
}