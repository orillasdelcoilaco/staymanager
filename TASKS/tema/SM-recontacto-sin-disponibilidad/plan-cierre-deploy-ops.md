# Cierre en producción — lista de espera / recontacto (solo operación)

Este archivo es para **quien tenga acceso** a Supabase (o Postgres de producción), Render y ChatGPT Actions. El código ya está en el repo; **Cursor/IDE no puede** entrar a esas consolas por ti.

**URLs y nombres canónicos** (dominio plataforma, host API, nombre del GPT): **`LEER-PRIMERO.md`** sección **Referencias de entorno**. Si el host en Render cambia, actualizar allí y este plan en el mismo cambio.

## 0. Checklist rápido

| Paso | Dónde | Hecho |
|------|--------|-------|
| 1 | SQL migración en **producción** | [ ] |
| 2 | **Deploy** backend (y front si aplica) en Render | [ ] |
| 3 | Variables Render (mínimo: `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, secret Firebase) | [ ] |
| 4 | GPT **SuiteManager Marketplace IA**: **reimportar** OpenAPI **1.4.8** desde `https://suite-manager.onrender.com/openapi-chatgpt.yaml` | [ ] |
| 5 | Prueba A–E (abajo) | [ ] |
| 6 | Marcar tema **Listo** en `TASKS/tablero.md` y en este README | [ ] |

---

## 1. Migración SQL (producción)

1. Abrir el SQL editor de **Supabase** (o el cliente SQL que usen contra la BD de producción).
2. Ejecutar **todo** el contenido del archivo del repo:

   `backend/db/migrations/espera-disponibilidad.sql`

3. Comprobar que existen tablas `espera_disponibilidad_estados` y `espera_disponibilidad` (y sin errores de permisos).

**Si no ejecutan este paso**, las rutas de lista de espera fallarán aunque el deploy sea correcto.

---

## 2. Deploy en Render

1. Hacer **merge/push** a la rama que dispara el deploy del servicio Node (según acuerdo del equipo).
2. Esperar build **exitoso** y que el servicio quede **Live**.
3. Opcional: variable `PUBLIC_API_CONTRACT_VERSION=1.4.8` (si no está, el código ya usa 1.4.8 por defecto en `publicRoutes.js`).

---

## 3. ChatGPT (Actions / GPT con herramientas)

1. En ChatGPT, abrir el GPT **SuiteManager Marketplace IA** y su configuración de **Actions**.
2. **Schema**: volver a cargar el OpenAPI desde la URL pública del backend en **Render**:

   `https://suite-manager.onrender.com/openapi-chatgpt.yaml`

3. Confirmar que el YAML descargado empieza con `version: 1.4.8` en `info.version`.
4. Comprobar con el navegador o curl:

   `GET https://suite-manager.onrender.com/api/public/version`  
   El campo `version` del JSON debe ser **1.4.8** (salvo override por env).

---

## 4. Pruebas mínimas (después del deploy)

Base del API en producción: `https://suite-manager.onrender.com` (si el dashboard de Render muestra otra URL canónica, usar esa y actualizar **`LEER-PRIMERO.md`** § Referencias de entorno).

**A — Versión**

```http
GET https://suite-manager.onrender.com/api/public/version
```

Esperado: `version` = `1.4.8` (o el valor de `PUBLIC_API_CONTRACT_VERSION` si lo fijaron).

**B — Lista de espera desde API pública (reserva sin cupo, con email)**

Usar el flujo documentado en OpenAPI: `POST /api/reservas` o `POST /api/public/reservas` con fechas sin disponibilidad y `huesped.email` válido.  
Esperado: respuesta **409** o **422** con objeto **`lista_espera`** y `registrado: true` (o `duplicado: true` si repiten el mismo caso).

**C — Intent legacy sin email (solo si usan esa ruta)**

`POST https://suite-manager.onrender.com/api/public/reservar/intent` con periodo bloqueado y **sin** email válido en `huesped`.  
Esperado: **400** con `code: WAITLIST_EMAIL_REQUIRED`.

**D — Panel**

Entrar al panel → **Lista de espera** (`/gestion-diaria/espera-disponibilidad`) y ver el registro.

**E — Correo**

Revisar bandeja (y Resend dashboard) por el mail de confirmación de alta en lista de espera si el caso B registró nuevo registro.

---

## 5. Cerrar el tema en el repo (quien haga QA)

Cuando los pasos 1–5 estén OK:

1. En **`TASKS/tablero.md`**: fila `SM-recontacto-sin-disponibilidad` → columna **Listo**, **Última nota** con fecha ISO y texto tipo: “Migración prod + deploy Render + GPT/OpenAPI 1.4.8 + smoke OK”.
2. En **`TASKS/tema/SM-recontacto-sin-disponibilidad/README.md`**: estado **Listo** y fecha.
3. Si en **`TASKS/backlog-producto-pendientes.md`** había un ítem explícito de este tema, marcarlo según el estilo del archivo.

---

## Notas

- **Firebase en Render**: el backend espera el JSON de cuenta de servicio en **`/etc/secrets/serviceAccountKey.json`** (Secret File en Render), no como lista de variables sueltas.
- **AGENT_API_KEYS**: recomendable en producción para restringir `POST` públicos de reserva/intent; si no está configurado, el código deja acceso abierto con rate limit (ver `backend/middleware/agentAuth.js`).
