// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

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
const estadosRoutes = require('./routes/estados.js');
const websiteConfigRoutes = require('./routes/websiteConfigRoutes.js');
const comentariosRoutes = require('./routes/comentarios.js');
const aiRoutes = require('./routes/aiRoutes.js');

// [NEW] Importar rutas públicas para IA
const publicRoutes = require('./routes/publicRoutes.js');

// [NEW] Importar rutas de componentes y amenidades
const componentesRoutes = require('./routes/componentes.js');
const amenidadesRoutes = require('./routes/amenidades.js');
const tiposElementoRoutes = require('./routes/tiposElemento.js');

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
            storageBucket: 'suite-manager-app.firebasestorage.app'
        });
    }

    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    console.log('[Startup] ¡Éxito! Conexión a Firestore (db) establecida.');

    const app = express();
    const PORT = process.env.PORT || 3001;
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.set('trust proxy', 1); // Fix for rate limiter on Render/Proxy
    app.use(cors());
    app.use(express.json());

    // **PRIORIDAD 0: Archivos Estáticos Públicos (CRÍTICO: Antes de Auth)**
    const backendPublicPath = path.join(__dirname, 'public');
    // Enable CORS for static files
    app.use('/public', cors({ origin: '*' }), express.static(backendPublicPath));

    // --- ORDEN DE RUTAS ESTRATÉGICO ---

    // **PRIORIDAD 1: Rutas de la API (/api/...)**
    const apiRouter = express.Router();

    // [NEW] Rutas Públicas (SIN Auth)
    // Estas rutas deben ir ANTES del middleware de autenticación
    // Enable CORS for public API
    apiRouter.use('/public', cors({ origin: '*' }), publicRoutes(db));

    const authMiddleware = createAuthMiddleware(admin, db);

    apiRouter.use('/auth', authRoutes(admin, db));
    apiRouter.use(authMiddleware);

    // ... Rutas existentes ...
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

    // [NEW] Rutas de Componentes y Amenidades
    apiRouter.use('/componentes', componentesRoutes(db));
    apiRouter.use('/amenidades', amenidadesRoutes(db));
    apiRouter.use('/tipos-elemento', tiposElementoRoutes(db));

    // Rutas faltantes agregadas
    apiRouter.use('/kpis', kpiRoutes(db));
    apiRouter.use('/crm', crmRoutes(db));
    apiRouter.use('/gestion', gestionRoutes(db));
    apiRouter.use('/empresa', empresaRoutes(db));
    apiRouter.use('/usuarios', usuariosRoutes(db));
    apiRouter.use('/plantillas', plantillasRoutes(db));
    apiRouter.use('/website', websiteConfigRoutes(db));
    apiRouter.use('/authGoogle', authGoogleRoutes(db));
    apiRouter.use('/historial-cargas', historialCargasRoutes(db));
    apiRouter.use('/propuestas', propuestasRoutes(db));
    apiRouter.use('/presupuestos', presupuestosRoutes(db));
    apiRouter.use('/gestion-propuestas', gestionPropuestasRoutes(db));
    apiRouter.use('/reportes', reportesRoutes(db));
    apiRouter.use('/mensajes', mensajesRoutes(db));
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[Startup] Servidor de StayManager escuchando en http://localhost:${PORT}`);
});

} catch (error) {
    console.error("--- ¡ERROR CRÍTICO DURANTE LA INICIALIZACIÓN! ---");
    console.error("Detalle del error:", error.message);
    process.exit(1);
}