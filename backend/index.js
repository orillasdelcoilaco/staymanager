// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// --- Importar Rutas y Middlewares ---
// ... (todas las importaciones se mantienen igual)
const { createAuthMiddleware } = require('./middleware/authMiddleware.js');
const { createTenantResolver } = require('./middleware/tenantResolver.js');

// ... (código de inicialización de Firebase se mantiene igual)

const db = admin.firestore();
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
// ... (todo el contenido de apiRouter se mantiene igual)
app.use('/api', apiRouter);

// **PRIORIDAD 2: Rutas Públicas Específicas (iCal, Integraciones)**
app.use('/ical', icalRoutes(db));
app.use('/integrations', integrationsRoutes(db));

// **PRIORIDAD 3: Sirviendo Archivos Estáticos del Frontend**
// Nota: Se sirve desde una ruta específica '/admin-assets' para evitar colisiones
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use('/admin-assets', express.static(frontendPath));


// **PRIORIDAD 4: Middleware de Resolución de Inquilino y Rutas SSR**
// Este bloque ahora manejará TODO el tráfico que no sea API o assets.
const tenantResolver = createTenantResolver(db);
app.use('/', tenantResolver, (req, res, next) => {
    // Si el tenantResolver encontró una empresa, pasa la petición al router del sitio web.
    if (req.empresa) {
        return websiteRoutes(db)(req, res, next);
    }
    // Si NO encontró una empresa, es una petición para la SPA.
    // Sirve el index.html y deja que el router del frontend se encargue.
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});