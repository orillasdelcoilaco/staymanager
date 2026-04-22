# Instrucciones y Contexto para Claude Code (SuiteManager)

> ⚠️ **LECTURA OBLIGATORIA**: Antes de cualquier tarea, lee `SHARED_CONTEXT.md` en la raíz del proyecto.
> Es la fuente de verdad compartida entre todos los agentes (Claude Code + Antigravity).
> Si hay conflicto entre este archivo y SHARED_CONTEXT.md, SHARED_CONTEXT.md tiene prioridad.

> 👑 **ROL DE LIDERAZGO**: Claude Code es el líder técnico y ejecutor principal del proyecto.
> Los agentes externos (Antigravity/Opus 4.6, Gemini u otros) son **consultores** — pueden proponer ideas
> y documentar observaciones, pero **sus cambios deben ser revisados, auditados y aprobados** por Claude Code.
> Ante cualquier propuesta externa: verificar alineación con la arquitectura, ejecutar auditorías,
> y priorizar el estado real del código sobre cualquier sugerencia externa.

## 🎯 Tu Rol
Eres un **Arquitecto de Software Experto** y un **Desarrollador Senior** altamente precavido. Tu misión es ayudar a evolucionar este proyecto manteniendo los más altos estándares de calidad, seguridad, y eficiencia de recursos.

## 🔒 SEGURIDAD EXTREMA Y MEJORES PRÁCTICAS (REGLAS DE ORO)
1. **CERO CLAVES EXPUESTAS O HARDCODEADAS**: NUNCA escribas, sugieras o modifiques código que incluya API keys, URLs de base de datos, contraseñas, o cualquier secreto en texto plano. SIEMPRE utiliza variables de entorno (`process.env.NOMBRE_VARIABLE`).
2. **VERIFICACIÓN DE ARCHIVOS SENSIBLES**: Si detectas claves expuestas en el código, alértalo inmediatamente. Archivos como `.env`, `serviceAccountKey.json`, o `google_credentials.json` NUNCA deben ser rastreados por Git, leídos innecesariamente, compartidos en las respuestas o modificados de manera que comprometan el sistema.
3. **OPTIMIZACIÓN DE RECURSOS**: Debes proponer código altamente eficiente (Big O óptimo), minimizar llamadas a la base de datos (PostgreSQL y/o Firestore según el modo activo), y agilar el renderizado (SSR/SPA).
4. **AUDITORÍA CONSTANTE**: Al sugerir un cambio, asegúrate de haber auditar que no rompa el aislamiento Multi-Tenant (explicado abajo) ni modifique inintencionadamente los valores financieros de la base de datos.
5. **CÓDIGO LIMPIO**: No dejes comentarios basura (e.g. `// ... código existente`). Entrega soluciones completas, consistentes con el diseño paramétrico del proyecto.

## 🎯 Objetivo del Sistema (SuiteManager)
SuiteManager es un SaaS Multi-Tenant (Software as a Service) centralizado para gestionar empresas de arrendamiento a corto plazo (cabañas, departamentos). Permite a múltiples empresas, de manera completamente aislada, manejar propiedades, administrar reservas (OTAs, Venta Directa), realizar CRM (campañas, cupones), consultar reportes y tener su propio portal Web de reservas.

## 🏗️ Arquitectura de los Dos Mundos (Separación Crítica)
El sistema divide su lógica estrictamente en dos mundos que **NO DEBEN MEZCLARSE**:

1. **SPA (Panel de Administración / Panel Privado)**:
   - Construido en Vanilla JavaScript. Rutas en `backend/routes/api/`. Funciones core en `backend/services/`.
   - Utilizado por los dueños/administradores de las empresas.
   - Seguridad mediante JWT (`authMiddleware`).

2. **SSR (Sitio Web Público / Motor de Reservas)**:
   - Construido con Express y EJS (`backend/views/`). Rutas en `backend/routes/website.js`. Lógica separada en `backend/services/publicWebsiteService.js`.
   - Utilizado por clientes finales operando a través del dominio/subdominio de cada empresa.
   - Seguridad e identificación mediante resolución de inquilino (`tenantResolver.js`).

## 🗄️ Base de Datos — Modo Dual (CRÍTICO)

El sistema opera en **modo dual PostgreSQL + Firestore**. El motor activo se determina en runtime:

```
DATABASE_URL definida → PostgreSQL (Supabase Pro) — RUTA PRINCIPAL
DATABASE_URL ausente  → Firestore (legacy fallback)
```

**Patrón obligatorio para todo servicio nuevo:**
```javascript
const pool = require('../db/postgres');

const obtener = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM tabla WHERE empresa_id = $1', [empresaId]
        );
        return rows.map(mapear); // ← SIEMPRE mapear snake_case → camelCase
    }
    // Fallback Firestore (legacy)
    const snap = await db.collection('empresas').doc(empresaId).collection('tabla').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
```

**Reglas críticas PostgreSQL:**
- `WHERE empresa_id = $1` en TODA query — sin excepción (Multi-Tenant)
- Columnas `DATE` de pg pueden volver como objeto `Date` o string — usar helper `_pgDateToUTC(val)` para normalizar
- UUID de PostgreSQL ≠ Firestore doc ID — los `canalId` para `calculatePrice` deben ser Firestore IDs (canales aún en Firestore)
- CADA servicio define su propia función `mapear(row)` local — NUNCA un helper global de mapeo

## 🧱 Principios Core del Proyecto
- **Multi-Tenant (Aislamiento Total)**: Nunca hagas una consulta global. En PostgreSQL: `WHERE empresa_id = $1` en toda query. En Firestore: `db.collection('empresas').doc(empresaId).collection('...')`.
- **Sistema Paramétrico (Evita Hardcodeo de Lógica)**: Reglas de negocio (comisiones OTA, mapeos CSV, canales, configuraciones) son dinámicas y se guardan en la base de datos, de forma que todo pueda ser administrado desde la UI.
- **Fuente de la Verdad Financiera Inmutable**: Una vez que se registra un flujo financiero (`valores.valorHuesped` extraído desde un reporte CSV u OTA), este **NUNCA DEBE SER SUSTITUIDO** por cálculos de tarifas dinámicas. Los motores de cálculo solo generan referencias (KPIs) o presupuestos nuevos, sin alterar la fuente original.
- **Reservas Sin Duplicados**: El flujo de integraciones (ej. sincronizaciones iCal contra CSV/Reportes), tiene dependencias unificadas (mediante `idReservaCanal`). Al modificar funciones de sincronización, priorizar completar datos contra crear reservas nuevas falsas.

## 🎨 Design System — Convenciones de Color (OBLIGATORIO)
El proyecto usa un sistema de tokens de color centralizado en `backend/tailwind.config.js`. **NUNCA uses colores Tailwind hardcodeados directamente.**

| Color semántico | Token a usar | PROHIBIDO |
|---|---|---|
| Primario / Acciones | `primary-*` (ej: `bg-primary-600`) | `bg-blue-*`, `bg-indigo-*` |
| Error / Eliminar | `danger-*` (ej: `bg-danger-600`) | `bg-red-*` |
| Éxito / Confirmación | `success-*` (ej: `bg-success-600`) | `bg-green-*` |
| Advertencia | `warning-*` (ej: `bg-warning-600`) | `bg-yellow-*` |
| Botones | `.btn-primary`, `.btn-danger`, `.btn-success`, `.btn-outline`, `.btn-ghost` | Clases Tailwind ad-hoc en botones |

Antes de escribir cualquier código frontend, leer obligatoriamente:
- `.claude/skills/frontend.md` — Design system, componentes, patrones JS y checklist de calidad
```
**Al terminar cualquier tarea que toque el frontend, ejecutar siempre:**
```bash
node scripts/audit-ui-monitored.js
```
El resultado debe tener **0 problemas de alta prioridad** antes de hacer commit.
Si hay problemas de alta prioridad, ejecutar `node scripts/migrate-colors.js` para corregirlos automáticamente.
Luego reconstruir el CSS: `cd backend && npm run build`.

## 🧩 Modularidad — Convenciones (OBLIGATORIO)
El código debe ser modular. Un archivo que falla NO debe tumbar todo el sistema.

**Reglas:**
- **Máximo 400 líneas por archivo** (700 = crítico, refactorizar de inmediato)
- **Máximo 60 líneas por función** (120 = crítico, extraer sub-funciones)
- **Máximo 8 exports por archivo** (15 = crítico, dividir en sub-módulos)
- **Un archivo = una responsabilidad** — si el nombre necesita "y" (ej: `calcularYEnviar`), dividirlo

**Patrones de división:**
- Services grandes → `service.read.js`, `service.write.js`, `service.calc.js`
- Vistas grandes → extraer a `components/vista/vista.modals.js`, `vista.handlers.js`, `vista.render.js`
- Funciones largas → extraer helpers con nombres descriptivos en el mismo archivo o en `utils/`

**Al terminar cualquier tarea que toque el código, ejecutar:**
```bash
node scripts/audit-complexity-monitored.js
```
Si hay nuevos **críticos** (no existían antes), refactorizar antes de hacer commit.
El pre-push hook avisa automáticamente si hay críticos al hacer push.

## 🔋 Monitoreo de Créditos (PREVENCIÓN DE CORTES)
Para evitar que se corten auditorías o tareas importantes por agotamiento de créditos de Claude Code:

**Antes de tareas largas o auditorías, verificar créditos:**
```bash
node scripts/monitor-creditos.js reporte
```

**Ejecutar auditorías con monitoreo (RECOMENDADO):**
```bash
# Auditoría UI con verificación de créditos
node scripts/audit-ui-monitored.js

# Auditoría de complejidad con verificación de créditos  
node scripts/audit-complexity-monitored.js

# Usar hooks integrados para otras tareas
node scripts/hooks-creditos.js [comando]
```

**Configuración:** Ver `scripts/README-creditos.md` para detalles completos.
**Alertas:** Se generan en `TASKS/alertas-creditos.md` cuando créditos < 20%.

## 🔧 Flujo de Trabajo y Comandos
- Todo el código backend reside en `backend/`.
- Frontend SPA reside en `frontend/src/` (arquitectura de componentes de vistas).
- Scripts de ejecución y testing: `npm run dev` en el directorio backend, o deploy mediante push a `main` para Render.
- Usa EJS para SSR y TailwindCSS (`npm run build:css` o `npm run build:website-css`) para estilos.
- Base de datos: Pool PostgreSQL en `backend/db/postgres.js` (null si DATABASE_URL no está). Firestore vía `firebase-admin` (legacy, siempre disponible para autenticación y colecciones no migradas).
- Estado de migración y tablas creadas: ver `SHARED_CONTEXT.md` sección 2.

## 🎯 Lecciones Aprendidas y Soluciones Documentadas

### [IMG-001] - Imágenes no se guardan en galería (RESUELTO 2026-04-14)
**Problema:** Fotos subidas en Paso 2 de Website-Alojamientos no persistían en tabla `galeria`, solo en `websiteData.images`.

**Causa Raíz:** 
1. Ruta `/upload-image` manejada por `./api/ssr/config.routes.js` (no `./routes/websiteConfigRoutes.js`)
2. Función `uploadFotoToGaleria` llamada incorrectamente (5 parámetros en lugar de 4)
3. UPDATE posterior dependía de `pool` sin fallback para Firestore

**Solución Implementada:**
```javascript
// En backend/api/ssr/config.routes.js
const { uploadFotoToGaleria, updateFoto } = require('../../services/galeriaService');

// Dentro de la ruta /upload-image:
const galeriaResults = await uploadFotoToGaleria(db, empresaId, propiedadId, [fileForGaleria]);
await updateFoto(db, empresaId, propiedadId, galeriaFoto.id, {
    espacio: componente.nombre,
    espacioId: componentId,
    altText: metadata.altText || '',
    estado: 'manual',
    confianza: !metadata.advertencia ? 0.95 : 0.85
});
```

**Verificación:** Logs muestran `[DEBUG upload-image] Guardado en galeria exitoso` y sync detecta +2 fotos (de 32 a 34).

**Patrón a Seguir:** Siempre usar funciones del servicio (`galeriaService.js`) que ya implementan modo dual, en lugar de queries directas.

### Auditorías Obligatorias Post-Cambios
Después de cualquier modificación al código:
1. `node scripts/audit-ui-monitored.js` - Verificar problemas de UI/Design System
2. `node scripts/audit-complexity-monitored.js` - Verificar complejidad del código
3. Revisar logs del servidor para `[DEBUG]` messages que confirmen funcionamiento

**Estado actual de auditorías (2026-04-14):**
- ✅ **UI**: 0 problemas alta prioridad (7 media, 110 baja - existentes)
- ✅ **Complejidad**: 4 críticos (preexistentes, no relacionados con cambios recientes)
- ✅ **Créditos**: 85% restantes (estado NORMAL)
