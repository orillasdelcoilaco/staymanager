// backend/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// --- Importar Rutas y Middlewares ---
const authRoutes = require('./routes/auth.js');
const propiedadesRoutes = require('./routes/propiedades.js');
const canalesRoutes = require('./routes/canales.js');
// ... (el resto de las importaciones se mantienen igual)
const crmRoutes = require('./routes/crm.js');
const websiteRoutes = require('./routes/website.js');
const integrationsRoutes = require('./routes/integrations.js');
const estadosRoutes = require('./routes/estados.js');
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
apiRouter.use('/estados', estadosRoutes(db));
app.use('/api', apiRouter);

// **PRIORIDAD 2: Rutas Públicas Específicas (iCal, Integraciones)**
app.use('/ical', icalRoutes(db));
app.use('/integrations', integrationsRoutes(db));

// **PRIORIDAD 3: Sirviendo Archivos Estáticos del Frontend**
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// **PRIORIDAD 4: Rutas del Sitio Web Público (SSR)**
const tenantResolver = createTenantResolver(db);
app.use('/', tenantResolver, websiteRoutes(db));

// **PRIORIDAD 5: Ruta "Catch-All" para la SPA (Debe ir al final de todo)**
// MODIFICACIÓN CLAVE: Esta ruta ahora solo se activa si el tenantResolver no encontró una empresa.
app.get('*', (req, res, next) => {
    // Si la petición ya fue manejada por el SSR (porque req.empresa existe), no hacemos nada.
    // Si no, servimos la SPA.
    if (!req.empresa) {
        return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    // Si req.empresa existe pero la ruta no coincidió con ninguna en website.js, 
    // es un 404 para el sitio público. Express lo manejará.
    next();
});


// --- Iniciar el Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor de StayManager escuchando en http://localhost:${PORT}`);
});