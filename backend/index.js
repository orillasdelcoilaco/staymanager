// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// --- Importar Rutas y Middlewares ---
// ... (todas las importaciones se mantienen igual)
const estadosRoutes = require('./routes/estados.js'); // Asegúrate de que esta línea esté
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
// ... (todo el contenido de apiRouter se mantiene igual, incluyendo apiRouter.use('/estados', estadosRoutes(db));)
app.use('/api', apiRouter);

// **PRIORIDAD 2: Rutas Públicas Específicas (iCal, Integraciones)**
app.use('/ical', icalRoutes(db));
app.use('/integrations', integrationsRoutes(db));

// **PRIORIDAD 3: Sirviendo Archivos Estáticos del Frontend (SPA) bajo /admin-assets**
const frontendPath = path.join(__dirname, '..', 'frontend');
// **MODIFICACIÓN CLAVE**: Servir la SPA desde una ruta específica
app.use('/admin-assets', express.static(frontendPath));

// **PRIORIDAD 4: Rutas del Sitio Web Público (SSR)**
const tenantResolver = createTenantResolver(db);
// **MODIFICACIÓN CLAVE**: El tenantResolver ahora va aquí.
app.use('/', tenantResolver, (req, res, next) => {
    // Si se encontró una empresa, se pasa al router del sitio web.
    if (req.empresa) {
        return websiteRoutes(db)(req, res, next);
    }
    // Si NO se encontró empresa, se asume que es para la SPA (login o ruta directa a admin).
    // Servimos el index.html de la SPA.
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// **PRIORIDAD 5: (Eliminada) La ruta catch-all anterior ya no es necesaria aquí.**
// La lógica ahora está dentro del middleware de la Prioridad 4.

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});