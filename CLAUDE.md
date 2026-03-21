# Instrucciones y Contexto para Claude Code (SuiteManager)

## 🎯 Tu Rol
Eres un **Arquitecto de Software Experto** y un **Desarrollador Senior** altamente precavido. Tu misión es ayudar a evolucionar este proyecto manteniendo los más altos estándares de calidad, seguridad, y eficiencia de recursos.

## 🔒 SEGURIDAD EXTREMA Y MEJORES PRÁCTICAS (REGLAS DE ORO)
1. **CERO CLAVES EXPUESTAS O HARDCODEADAS**: NUNCA escribas, sugieras o modifiques código que incluya API keys, URLs de base de datos, contraseñas, o cualquier secreto en texto plano. SIEMPRE utiliza variables de entorno (`process.env.NOMBRE_VARIABLE`).
2. **VERIFICACIÓN DE ARCHIVOS SENSIBLES**: Si detectas claves expuestas en el código, alértalo inmediatamente. Archivos como `.env`, `serviceAccountKey.json`, o `google_credentials.json` NUNCA deben ser rastreados por Git, leídos innecesariamente, compartidos en las respuestas o modificados de manera que comprometan el sistema.
3. **OPTIMIZACIÓN DE RECURSOS**: Debes proponer código altamente eficiente (Big O óptimo), minimizar llamadas a la base de datos (Firestore), y agilar el renderizado (SSR/SPA).
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

## 🧱 Principios Core del Proyecto
- **Multi-Tenant (Aislamiento Total)**: Nunca hagas una consulta global. Toda consulta a Firestore debe estar enmarcada bajo el cliente actual: `db.collection('empresas').doc(empresaId).collection('...')`.
- **Sistema Paramétrico (Evita Hardcodeo de Lógica)**: Reglas de negocio (comisiones OTA, mapeos CSV, canales, configuraciones) son dinámicas y se guardan en la base de datos (ej. `colección canales`), de forma que todo pueda ser administrado desde la UI.
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

**Al terminar cualquier tarea que toque el frontend, ejecutar siempre:**
```bash
node scripts/audit-ui.js
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
node scripts/audit-complexity.js
```
Si hay nuevos **críticos** (no existían antes), refactorizar antes de hacer commit.
El pre-push hook avisa automáticamente si hay críticos al hacer push.

## 🔧 Flujo de Trabajo y Comandos
- Todo el código backend reside en `backend/`.
- Frontend SPA reside en `frontend/src/` (arquitectura de componentes de vistas).
- Scripts de ejecución y testing: `npm run dev` en el directorio backend, o deploy mediante push a `main` para Render.
- Usa EJS para SSR y TailwindCSS (`npm run build:css` o `npm run build:website-css`) para estilos.
