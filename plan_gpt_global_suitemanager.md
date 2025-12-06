# Plan Maestro de Implementacion GPT SuiteManager IA

Este documento define claramente **cada etapa**, **los objetivos**, **entregables**, y **criterios de exito** para integrar completamente el GPT Global, los GPT Privados, el modulo IA Concierge, y toda la logica relacionada en SuiteManager IA.

Servira como **documento de referencia permanente**.

---

# 1. Configuracion y Publicacion del GPT Global

### Objetivo
Crear y publicar el GPT Global de SuiteManager IA, sincronizado con el backend, con Actions activadas y comportamiento optimizado.

### Alcance
* Cargar manifiesto final (v2.0)
* Cargar instrucciones optimizadas
* Validar comportamiento comercial

### Entregables
* GPT Global activo
* Actions conectadas

### Criterios de Exito
* GPT inicia con intencion correcta
* Calcula fechas automaticamente
* Muestra maximo 2 fotos

---

# 10. Gobernanza, RACI y timeline

### Objetivo
Asignar duenos, orden de ejecucion y fechas claras.

### Datos de Contacto y RACI
| Rol | Responsable |
|---|---|
| **PM** | Pablo Meza |
| **Eng Lead** | Antigravity AI |
| **Soporte** | Equipo SuiteManager |
| **Direccion** | Administracion |

- **Go/No-Go**: Validado el 05/12/2025 (Estado: READY)

---

# 11. Contratos de Actions y prefiltro backend

### Detalles Tecnicos de la API
- **Base URL**: `https://suitemanagers.com`
- **Rate Limit**: 60 requests/min por IP.
  - **Exceso**: Si se supera, backend responde 429.
  - **Backoff**: El GPT debe esperar 5 segundos y reintentar.
- **Tenant Isolation**:
  - `x-empresa-id` es **Opcional** para busquedas globales (Marketplace).
  - `x-empresa-id` es **Obligatorio** para GPTs Privados (Forzado por TenantResolver).

### Codigos de Estado
| Codigo | Descripcion | Accion del GPT |
|---|---|---|
| `200` | OK | Procesar JSON. |
| `400` | Bad Request | Pedir al usuario aclarar el mensaje. |
| `404` | Not Found | "No encontre disponibilidad. ¿Buscamos en otra fecha?" |
| `429` | Rate Limit | "Dame un momento..." (Esperar 5s). |
| `500` | Server Error | "Error tecnico momentaneo." |

### Contratos Validados (API Real)

1. **`/api/concierge/intention-detect`** (POST)
   - Input: `{ "mensaje": "..." }`
   - Output: `{ "intencion": "reserva", "ubicacion": "Pucon" }`

2. **`/api/concierge/availability`** (POST)
   - Input: `{ "personas": 4, "fecha_entrada": "...", "ubicacion": "..." }`
   - Output: `{ "opciones": [ { "nombre": "Cabana 1", "preview": ["url1"], "precio_noche": 100 } ] }`
   - Limites: Max 5 items, Max 2 fotos.

3. **`/api/concierge/more-photos`** (GET)
   - Input: `alojamientoId`, `tipo`
   - Output: `{ "fotos": [ { "url": "..." } ] }`

---

# 13. Observabilidad y costos

### Estrategia de Monitoreo
1. **Fuentes de Datos**:
   - Logs de Render (`[Query]`, `[Router]`).
   - Dashboard de OpenAI (Uso de Actions).
2. **Metricas Clave**:
   - **Costo**: Tokens estimados (4 chars = 1 token).
   - **Latencia**: Tiempo de respuesta de API (< 500ms objetivo).
   - **Router**: % de uso de modelos Baratos vs Caros.
3. **Alertas**:
   - Errores 5xx -> Notificacion Email (Render).
   - Latencia > 5s -> Log Warning.

---

# 18. Checklist extendido de publicacion (Evidencia)

* **Roles y fechas**: Definidos en Secc. 10.
* **Contratos de Actions**: Documentados en Secc. 11.
* **Pruebas criticas**: 
  - Ejecutadas el 05/12/2025.
  - Script: `backend/scripts/test_concierge_rigorous.js`
  - Resultado: 100% PASS (Intention, Avail, Router).
* **Observabilidad**: Logs activos en entorno Prod.
* **Sales Mode**: Integrado en prompt (`query.routes.js`).
* **Privacidad**: `x-empresa-id` validado en tests.
* **Operacion**: Rollback probado via Git.
* **Versionado**: Manifest v2.0 (`backend/agent/gpt-global-manifest.js`).
* **Fotos optimizadas**: Max 2 fotos verificado en `filters.js`.
* **Sin inventar datos**: Logica de negocio en `filters.js` previene alucinaciones.

---

# FIN DEL DOCUMENTO
