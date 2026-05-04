# Inicio de integración Beds24 (operación + técnica)

**Contexto:** Google no acepta nuevos connectivity partners **directos**; vía razonable = **channel manager** ya certificado. **Referencia:** `TASKS/google-hotels-estrategia-post-partner-google.md`.

**Enlaces oficiales Beds24 (revisar versiones en su sitio):**

- [Developer API](https://www.beds24.com/developer-api.html)
- [API V2 — wiki](https://wiki.beds24.com/index.php/API_V2.0) (V1 desaconsejada para proyectos nuevos)
- [Google Hotel Ads & Google for Vacation Rentals — wiki](https://wiki.beds24.com/index.php/Google_Hotel_Ads_&_Google_for_Vacation_Rentals)
- Página de control API (cuenta logueada): `https://www.beds24.com/control3.php?pagetype=apiv2` (ruta típica; confirmar en menú **SETTINGS → ACCOUNT** según UI actual)

---

## Fase A — Cuenta y plan (negocio)

1. **Crear o usar cuenta** Beds24 para el operador (ej. Orillas del Coilaco). Definir si es **una cuenta por empresa** o pruebas en sandbox/cuenta demo.
2. **Elegir plan** que cubra: número de propiedades/unidades, **canal Google** si aplica, y **acceso API** (suele ir en planes superiores — **validar** en [beds24.com](https://www.beds24.com) / facturación).
3. **Decidir “fuente de verdad”** hasta que exista conector SuiteManager:
   - **A)** Gestionar precios/inventario **solo en Beds24** y usar su motor para Google; SuiteManager sigue siendo PMS de operación diaria, o  
   - **B)** Gestionar en SuiteManager y **más adelante** sincronizar hacia Beds24 (requiere el módulo de integración).  
   Documentar la decisión para no duplicar reservas.

---

## Fase B — Conectar Google **desde Beds24** (sin código)

Objetivo: presencia en Google vía el partner **Beds24**, no vía feeds propios de SuiteManager en Hotel Center.

1. Completar ficha de propiedad en Beds24: **dirección, teléfono, lat/lng, fotos** (p. ej. mínimo de imágenes para **Vacation Rentals** según wiki), datos coherentes con Google Business si existe.
2. **CHANNEL MANAGER** (o equivalente) → **Google** (Hotel Ads / Vacation Rentals según tipo de alojamiento). Seguir el asistente: **mapeo** con Google, **Notify / Synchronise** según documentación.
3. Tiempo de verificación en Google: **hasta ~14 días** es un orden de magnitud citado en documentación pública; no es un SLA de SuiteManager.

**Google Help (contexto):** [Connectivity partners: How to get started](https://support.google.com/hotelprices/answer/11947461?hl=en) — orientación genérica del lado Google.

---

## Fase C — API Beds24 (fundamentos para futuro módulo SuiteManager)

1. En Beds24: **SETTINGS → ACCOUNT → ACCOUNT ACCESS** — habilitar **API V2**.
2. Generar credenciales según modelo actual (**invite code**, **long-life read**, **refresh token** para escritura). Ver wiki API V2 y límites de uso (**no** spamear llamadas; espaciar peticiones).
3. **Probar fuera del repo** primero: Swagger/UI oficial si está disponible, o `curl` con token en cabecera según doc — validar lectura de propiedades / disponibilidad antes de escribir código en SuiteManager.
4. **Seguridad:** nunca commitear tokens; en producción solo variables de entorno (ej. `BEDS24_*` en Render).

---

## Fase D — Módulo SuiteManager (cuando se priorice en backlog)

- Diseño en **`TASKS/google-hotels-estrategia-post-partner-google.md` §5 + §6**.
- Servicio dedicado (ej. `backend/services/beds24/`), aislamiento **multi-tenant**, sin romper `valorHuesped` ni reglas financieras.
- Webhooks o jobs según ofrezca Beds24 para reservas y conflictos de inventario.

---

## Checklist rápido “empezar esta semana”

| # | Acción |
|---|--------|
| 1 | Confirmar plan Beds24 + API + canal Google para el número de unidades reales |
| 2 | Completar datos de propiedad en Beds24 y abrir canal Google siguiendo wiki |
| 3 | Habilitar API V2 y guardar tokens en gestor de secretos (no repo) |
| 4 | Prueba manual API (GET propiedades/bookings) desde Postman o script local |
| 5 | Tras estabilizar operación en Beds24+Google, abrir ítem de producto para **Fase D** (conector SM) |

---

*Última actualización: 2026-05-05 — guía de arranque; precios y pantallas pueden cambiar en Beds24.*
