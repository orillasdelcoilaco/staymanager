// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Iniciar servidor MCP en segundo plano
const mcpPath = path.join(__dirname, '..', 'ai', 'openai', 'mcp-server', 'index.js');
const mcp = spawn('node', [mcpPath], { stdio: 'inherit' });

mcp.on('close', () => console.log("MCP Server closed"));
mcp.on('error', (err) => console.error("ERROR MCP:", err));

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

// [NEW] Rutas para Agentes IA (ChatGPT Actions)
const agentesRoutes = require("./routes/agentes");

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

    // [PROXY] Redirigir tráfico MCP al subproceso en puerto 4002
    // Esto expone /.well-known/ai-mcp y /mcp/* públicamente
    app.use(['/.well-known/ai-mcp', '/mcp'], createProxyMiddleware({
        target: 'http://localhost:4002',
        changeOrigin: true,
        logLevel: 'debug'
    }));

    // Habilitar CORS solo para las rutas de OpenAPI
    app.use('/openapi', cors(), express.static(path.join(__dirname, '../openapi'), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.json')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutos
            }
        }
    }));

    // Ruta directa a /openapi.json
    app.get('/openapi.json', cors(), (req, res) => {
        const file = path.join(__dirname, '../openapi', 'openapi.json');
        res.sendFile(file, err => {
            if (err) {
                console.error('Error al servir openapi.json:', err);
                res.status(500).send({ error: 'Error interno al leer openapi.json' });
            }
        });
    });

    // Ruta para openapi-chatgpt.yaml
    app.get("/openapi-chatgpt.yaml", cors(), (req, res) => {
        res.sendFile(path.join(__dirname, "../openapi/openapi-chatgpt.yaml"));
    });

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

    // [NEW] Rutas para Agentes IA (ChatGPT Actions)
    apiRouter.use("/ai", agentesRoutes);

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
    apiRouter.use('/comentarios', comentariosRoutes(db));
    apiRouter.use('/estados', estadosRoutes(db));
    apiRouter.use('/ai', aiRoutes(db));

    app.use('/api', apiRouter);

    // **PRIORIDAD 3: Frontend Admin**
    const frontendPath = path.join(__dirname, '..', 'frontend');
    app.use('/admin-assets', express.static(frontendPath));

    // **PRIORIDAD 5: SSR Router**
    const tenantResolver = createTenantResolver(db);
    app.use('/', tenantResolver, (req, res, next) => {
        if (req.empresa) {
            return websiteRoutes(db)(req, res, next);
        }
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