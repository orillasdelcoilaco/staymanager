require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

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
const { createMarketplaceRouter } = require('./routes/marketplace.js');
const integrationsRoutes = require('./routes/integrations.js');
const estadosRoutes = require('./routes/estados.js');
const websiteConfigRoutes = require('./api/ssr/config.routes.js');
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

// [NEW] Rutas REST para ChatGPT (SIN Auth)
const apiRoutes = require("./routes/api");

// [NEW] Ruta para Búsqueda General IA (Marketplace)
const iaRoutes = require("./routes/ia");

// [NEW] Importador Mágico (análisis de web + creación de empresa)
const importerRoutes = require('./routes/importerRoutes');
const historicoImporterRoutes = require('./routes/historicoImporterRoutes');
const bloqueosRoutes = require('./routes/bloqueosRoutes');
const resenasRoutes = require('./routes/resenas');

// [NEW] Galería de fotos por propiedad (revisión manual + sync SSR)
const galeriaRoutes = require('./routes/galeriaRoutes');
const mapeosCentralesRoutes = require('./routes/mapeosCentrales');

// Catálogo universal de activos (para wizard gestión de propiedades)
const catalogoRoutes = require('./routes/catalogoRoutes');
const geocodeRoutes = require('./routes/geocode');

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

    // [NEW] Ruta para openapi-gemini.yaml
    app.get("/openapi-gemini.yaml", cors(), (req, res) => {
        res.sendFile(path.join(__dirname, "../openapi/openapi-gemini.yaml"));
    });

    // [NEW] Ruta para claude-tools.json
    app.get("/claude-tools.json", cors(), (req, res) => {
        res.sendFile(path.join(__dirname, "../openapi/claude-tools.json"));
    });

    const PORT = process.env.PORT || 3001;
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.set('trust proxy', 1); // Fix for rate limiter on Render/Proxy
    app.use(cors());
    app.use(express.json({ limit: '20mb' }));

    // [DEBUG] Global Request Logger
    app.use((req, res, next) => {
        console.log(`[INCOMING] ${req.method} ${req.url} | Content-Type: ${req.headers['content-type']}`);
        next();
    });

    // **PRIORIDAD 0: Archivos Estáticos Públicos (CRÍTICO: Antes de Auth)**
    const backendPublicPath = path.join(__dirname, 'public');
    app.use('/public', cors({ origin: '*' }), express.static(backendPublicPath));

    // ── Marketplace search API pública (antes del apiRouter con auth) ─────
    const { sendMarketplaceSearchJson } = require('./routes/marketplaceSearchJson.handler');
    app.get('/api/search.json', cors(), sendMarketplaceSearchJson);

    // --- ORDEN DE RUTAS ESTRATÉGICO ---

    // **PRIORIDAD 1: Rutas de la API (/api/...)**
    const apiRouter = express.Router();

    // [NEW] Rutas Públicas (SIN Auth)
    apiRouter.use('/public', cors({ origin: '*' }), publicRoutes(db));

    // [NEW] Concierge AI Module (Publico)
    const conciergeChatRoutes = require('./api/concierge/chat.routes.js');
    const conciergeGalleryRoutes = require('./api/concierge/gallery.routes.js');
    const intentRoutes = require('./api/concierge/intention.routes.js');
    const availRoutes = require('./api/concierge/availability.routes.js');
    const photoActionRoutes = require('./api/concierge/photos.routes.js');
    const queryRoutes = require('./api/concierge/query.routes.js');

    apiRouter.use('/concierge', cors({ origin: '*' }), conciergeChatRoutes(db));
    apiRouter.use('/concierge', cors({ origin: '*' }), conciergeGalleryRoutes(db));
    apiRouter.use('/concierge', cors({ origin: '*' }), intentRoutes(db));
    apiRouter.use('/concierge', cors({ origin: '*' }), availRoutes(db));
    apiRouter.use('/concierge', cors({ origin: '*' }), photoActionRoutes(db));
    apiRouter.use('/concierge', cors({ origin: '*' }), queryRoutes(db));

    // [NEW] Rutas para Agentes IA (ChatGPT Actions)
    // Se monta en /ai para coincidir con OpenAPI (/ai/buscar-empresa)
    app.use("/ai", cors({ origin: '*' }), agentesRoutes);

    // [NEW] Ruta para Búsqueda General IA (Marketplace)
    app.use("/ia", cors({ origin: '*' }), iaRoutes);

    // [NEW] Rutas REST para ChatGPT (SIN Auth)
    apiRouter.use(cors({ origin: '*' }), apiRoutes);

    const authMiddleware = createAuthMiddleware(admin, db);

    apiRouter.use('/auth', authRoutes(admin, db));
    // Callback de Google OAuth — debe ir SIN authMiddleware (Google redirige sin JWT)
    apiRouter.use('/auth/google', authGoogleRoutes(db));
    // [NEW] Importador Mágico (SIN authMiddleware — crea su propio usuario)
    apiRouter.use('/importer', importerRoutes(admin, db));
    apiRouter.use(authMiddleware);

    // ... Rutas existentes ...
    apiRouter.use('/historico-importer', historicoImporterRoutes(db));
    apiRouter.use('/bloqueos', bloqueosRoutes(db));
    apiRouter.use('/propiedades', propiedadesRoutes(db));
    apiRouter.use('/canales', canalesRoutes(db));
    apiRouter.use('/tarifas', tarifasRoutes(db));
    apiRouter.use('/conversiones', conversionesRoutes(db));
    apiRouter.use('/clientes', clientesRoutes(db));
    apiRouter.use('/reservas', reservasRoutes(db));
    apiRouter.use('/sincronizar', sincronizacionRoutes(db));
    apiRouter.use('/mapeos', mapeosRoutes(db));
    apiRouter.use('/mapeos-centrales', mapeosCentralesRoutes(db));
    apiRouter.use('/geocode', geocodeRoutes(db));
    apiRouter.use('/calendario', calendarioRoutes(db));
    apiRouter.use('/reparar', reparacionRoutes(db));
    apiRouter.use('/dolar', dolarRoutes(db));

    // [NEW] Rutas de Componentes y Amenidades
    apiRouter.use('/galeria', galeriaRoutes(db));
    apiRouter.use('/componentes', componentesRoutes(db));
    apiRouter.use('/amenidades', amenidadesRoutes(db));
    apiRouter.use('/tipos-elemento', tiposElementoRoutes(db));
    apiRouter.use('/catalogo', catalogoRoutes);

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
    apiRouter.use('/resenas', resenasRoutes(db));
    apiRouter.use('/ai', aiRoutes(db));

    // [NEW] Content Factory Routes (SSR Generation Pipeline)
    const contentFactoryRoutes = require('./api/ssr/content.routes.js');
    apiRouter.use('/content-factory', contentFactoryRoutes(db));

    app.use('/api', apiRouter);

    // **PRIORIDAD 3: Frontend Admin**
    const frontendPath = path.join(__dirname, '..', 'frontend');
    app.use('/admin-assets', express.static(frontendPath));

    // **PRIORIDAD 4: Páginas Legales Globales**
    const legalRoutes = require('./routes/legal.js');
    app.use('/legal', legalRoutes);

    // **PRIORIDAD 4.5: Formulario de Reseñas Público (sin auth, sin tenantResolver)**
    const {
        obtenerPorToken,
        marcarTokenUsado,
        guardarResena,
        registrarClickGoogle,
        clienteBloqueadoParaResenaToken,
    } = require('./services/resenasService');

    app.get('/r/:token', async (req, res) => {
        try {
            const resena = await obtenerPorToken(req.params.token);
            if (!resena) return res.status(404).render('404', { empresa: { nombre: 'SuiteManager' } });
            if (resena.punt_general) {
                return res.send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Esta reseña ya fue enviada. ¡Gracias!</h2></body></html>');
            }
            if (await clienteBloqueadoParaResenaToken(req.params.token)) {
                return res.status(403).send(
                    '<html><body style="font-family:sans-serif;text-align:center;padding:48px;max-width:520px;margin:0 auto">'
                    + '<h2>No disponible</h2><p style="color:#444;line-height:1.5">Este enlace no puede usarse para dejar una reseña.</p></body></html>'
                );
            }
            await marcarTokenUsado(req.params.token);
            res.render('review', { resena });
        } catch (err) {
            console.error('[review] GET /r/:token:', err.message);
            res.status(500).send('Error al cargar el formulario.');
        }
    });

    app.post('/api/resenas/submit/:token', express.json(), async (req, res) => {
        try {
            const result = await guardarResena(req.params.token, req.body);
            if (!result) return res.status(409).json({ error: 'Ya enviada o token inválido' });
            res.json({ ok: true });
        } catch (err) {
            console.error('[review] POST submit:', err.message);
            if (err.code === 'CLIENTE_BLOQUEADO') {
                return res.status(403).json({ error: err.message });
            }
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/resenas/google-click/:token', async (req, res) => {
        try {
            await registrarClickGoogle(req.params.token);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // **PRIORIDAD 5: SSR Router**
    const tenantResolver = createTenantResolver(db);

    // Limpiar cookie force_host (para dev local — salir del modo preview)
    app.get('/clear-preview', (_req, res) => {
        res.setHeader('Set-Cookie', 'force_host=; Path=/; Max-Age=0');
        res.redirect('/');
    });

    // ── SEO global (robots.txt, sitemap.xml) ─────────────────────────────
    const { generarSitemap, ROBOTS_TXT } = require('./services/marketplace.seo.js');
    app.get('/robots.txt', (_req, res) => {
        res.type('text/plain').send(ROBOTS_TXT);
    });
    app.get('/sitemap.xml', async (_req, res) => {
        try {
            const xml = await generarSitemap();
            res.type('application/xml').send(xml);
        } catch (err) {
            console.error('[SEO] Error generando sitemap:', err);
            res.status(500).send('Error generando sitemap');
        }
    });

    // Redirect marketplace → propiedad de empresa (funciona en dev y prod)
    const { PLATFORM_DOMAIN: MP_DOMAIN } = require('./services/marketplaceService');
    app.get('/ir', (req, res) => {
        const { s: subdominio, id } = req.query;
        if (!subdominio || !id) return res.redirect('/');
        const sub = subdominio.toLowerCase();
        if (process.env.RENDER) {
            return res.redirect(`https://${sub}.${MP_DOMAIN}/propiedad/${id}`);
        }
        const base = `${req.protocol}://${req.get('host')}`;
        res.redirect(`${base}/propiedad/${id}?force_host=${sub}.${MP_DOMAIN}`);
    });

    app.use('/', tenantResolver, (req, res, next) => {
        // Rutas SPA — siempre van al admin panel, aunque haya cookie force_host activa
        const spaPaths = ['/login', '/logout', '/register', '/forgot-password'];
        if (spaPaths.includes(req.path)) {
            return res.sendFile(path.join(frontendPath, 'index.html'));
        }
        if (req.isMarketplace) {
            return createMarketplaceRouter(db)(req, res, next);
        }
        if (req.empresa) {
            return websiteRoutes(db)(req, res, next);
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
        const bindHint = process.env.RENDER
            ? `0.0.0.0:${PORT} (URL pública la define Render, no esta dirección)`
            : `http://localhost:${PORT}`;
        console.log(`[Startup] Servidor de StayManager escuchando en ${bindHint}`);
        require('./jobs/expirarPropuestasIA').iniciar();
    });

} catch (error) {
    console.error("--- ¡ERROR CRÍTICO DURANTE LA INICIALIZACIÓN! ---");
    console.error("Detalle del error:", error.message);
    process.exit(1);
}