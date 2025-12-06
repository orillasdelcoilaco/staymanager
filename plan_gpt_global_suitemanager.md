# Plan Maestro de Implementacion GPT SuiteManager IA

Este documento define claramente **cada etapa**, **los objetivos**, **entregables**, y **criterios de exito** para integrar completamente el GPT Global, los GPT Privados, el modulo IA Concierge, y toda la logica relacionada en SuiteManager IA.

---

# 1. Configuracion y Publicacion del GPT Global (Completado)

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

# 2. Pruebas en vivo con datos reales

### Objetivo
Validar el comportamiento del GPT Global contra alojamientos reales.

### Alcance
* Probar con fechas futuras
* Probar fines de semana
* Probar diferentes cantidades de personas
* Probar consultas triviales
* Probar peticiones de fotos

### Entregables
* Reporte de pruebas manuales
* Ajustes de UX conversacional si es necesario

### Criterios de Exito
* El GPT responde sin errores
* El JSON del backend es respetado sin inventar datos
* Los alojamientos que salen tienen sentido
* No utiliza Vision

---

# 3. Ajuste de estilo comercial y experiencia del usuario

### Objetivo
Optimizar el tono, estilo y formato de las respuestas para maximizar la conversion.

### Alcance
* Ajustar el copywriting
* Definir voz del asistente
* Optimizar CTAs
* Reducir palabras innecesarias
* Mejorar formato visual (bullets, claridad)

### Entregables
* Version final del estilo comercial
* Instrucciones actualizadas en el GPT

### Criterios de Exito
* El asistente suena profesional, calido y directo
* Orienta siempre a reservar
* Mantiene respuestas cortas

---

# 4. Modo vendedor (Sales Booster Mode)

### Objetivo
Implementar un modo interno que aumente conversiones guiando al usuario a reservar.

### Alcance
* Argumentos de valor
* Mensajes para urgencia
* Presentacion de beneficios
* Comparaciones de opciones

### Entregables
* Plantilla de "Sales Mode"
* Ejemplos y seed messages
* Ajuste de instrucciones del GPT

### Criterios de Exito
* El asistente genera mas acciones "si, quiero reservar"
* Las conversiones aumentan en pruebas controladas

---

# 5. Dashboard de Costos y Uso

### Objetivo
Medir el costo real del GPT Global y validar la eficiencia del router.

### Alcance
* Contador local de tokens estimados
* Logs del router (modelo barato vs modelo caro)
* Resumen diario
* Alertas de costos altos

### Entregables
* Dashboard interno simple (JSON/HTML/API)
* Script de calculo de tokens

### Criterios de Exito
* Router usa modelo barato > 60% del tiempo
* Tokens promedio por consulta < 300

---

# 6. Creacion y publicacion de GPTs privados

### Objetivo
Crear un asistente IA privado para cada empresa.

### Alcance
* Revisar /agent-factory
* Crear manifiesto privado
* Crear GPTs individuales
* Validar Actions por empresa

### Entregables
* GPT Privado por empresa
* Flujo interno documentado

### Criterios de Exito
* El GPT nunca busca fuera de su empresa (`x-empresa-id` forzoso)
* Solo usa 1 Action: disponibilidad privada
* Responde con identidad propia

---

# 7. Pruebas de escalabilidad multiempresa

### Objetivo
Garantizar funcionamiento con N empresas.

### Alcance
* Probar multiples empresas con alojamientos distintos
* Validar prefiltrado real
* Probar GPT privado con datos faltantes

### Entregables
* Reporte multicliente
* Ajustes al prefiltrado

### Criterios de Exito
* No hay fugas de informacion
* Performance estable
* Fotos datos correctos por empresa

---

# 8. Simulaciones de reservas

### Objetivo
Simular escenarios reales (familias, parejas).

### Alcance
* Pruebas de estres de flujo
* Solicitudes urgentes
* Sin disponibilidad

### Entregables
* Simulaciones chat log
* Ajustes de naturalidad

### Criterios de Exito
* Manejo de escenarios complejos
* Alternativas cuando no hay disponibilidad

---

# 9. Validacion final y checklist

### Objetivo
Validar que SuiteManager IA esta listo para escalar.

### Criterios Finales
* GPT Global/Privados OK
* Actions OK
* Router OK
* Dashboard OK
* Multiempresa OK
* Estilo OK
* Fotos OK
* Deploy OK

---

# 10. Gobernanza, RACI y timeline

### Objetivo
Asignar duenos, orden de ejecucion y fechas claras.

### RACI por Etapa
| Etapa | Responsable (R) | Aprobador (A) | Consultado (C) | Informado (I) |
|---|---|---|---|---|
| **1. GPT Global** | Eng Lead (Antigravity) | PM (Pablo) | Soporte | Direccion |
| **Actions API** | Eng Lead | PM | - | - |
| **Sales Mode** | PM | Direccion | Soporte | - |
| **Multiempresa** | Eng Lead | PM | - | Direccion |

### Hitos Clave
* **Inicio Fase 2**: 01/12/2025
* **Validacion Tecnica (Tests)**: 05/12/2025 (Completado)
* **Go/No-Go Produccion**: 05/12/2025 (Estado: READY)
* **Rollout Gradual**: 10/12/2025 (Estimado)

---

# 11. Contratos de Actions y prefiltro backend

### Detalles Tecnicos de la API
- **Base URL**: `https://suitemanagers.com`
- **Rate Limit**:
  - **Global**: 60 requests/min por IP.
  - **Por Tenant**: Sin limite estricto aun (Monitorizado).
  - **Exceso (429)**: Header `Retry-After: 5` (Segundos).
- **Auth & Tenant Isolation**:
  - `x-empresa-id` es **Opcional** en Marketplace (el router decide o usa default).
  - `x-empresa-id` es **Obligatorio** en Privados (si falta -> 400 Bad Request).

### Codigos de Estado y Manejo de Errores
| Codigo | Descripcion | Accion del GPT |
|---|---|---|
| `200` | OK | Procesar JSON. |
| `400` | Bad Request | Faltan campos (ej. `mensaje` vacio) o ID de empresa invalido. |
| `404` | Not Found | Sin resultados. Responder: "No encontre disponibilidad en esas fechas." |
| `405` | Method Not Allowed | Error de integracion (Usar POST). |
| `408` | Timeout | Backend tardo >10s. Responder: "Demora tecnica, reintentando..." |
| `429` | Rate Limit | Pausar y reintentar segun `Retry-After` (def: 5s). |
| `500` | Server Error | Responder: "Lo siento, tuve un error tecnico momentaneo." |

### Contratos Validados

1. **`/api/concierge/intention-detect`** (POST)
   - Schema: `{ "mensaje": "string" }`
   - Output: `{ "intencion": "reserva", "ubicacion": "string", "fechas": object }`

2. **`/api/concierge/availability`** (POST)
   - Schema: `{ "personas": int, "fecha_entrada": "YYYY-MM-DD", "fecha_salida": "YYYY-MM-DD", "ubicacion": "string" }`
   - Output: `{ "opciones": [ { "nombre": "...", "preview": ["url"], "precio_noche": int } ] }`
   - Limits: Max 5 items. Max 2 fotos.

3. **`/api/concierge/more-photos`** (GET)
   - Query: `?alojamientoId=X&tipo=dormitorio`
   - Output: `{ "fotos": [ { "url": "..." } ] }`

---

# 12. Pruebas, regresiones y reportes

### Objetivo
Asegurar cobertura de pruebas continua.

### Alcance
* Testing automatico (`test_concierge_rigorous.js`).
* Testing manual de flujos de conversacion.

---

# 13. Observabilidad y costos

### Estrategia de Monitoreo
| Capa | Herramienta Actual | Herramienta Futura (Q1 2026) |
|---|---|---|
| **Metricas** | Console Logs (`[Query]`) | Prometheus/Datadog |
| **Tokens** | Estimacion (4 chars = 1 token) | Libreria `tiktoken` (Backend) |
| **Alertas** | Email (Render Native 5xx) | Slack Webhook (#alerts-suiteia) |

**Umbrales de Alerta Actuales:**
- **Latencia Critica**: > 10s (Logs muestran timeout).
- **Error Rate**: > 5% (Monitorizado manualmente en deploy).
- **Costos**: Revision semanal de uso de tokens OpenAI.

---

# 14. Sales Booster Mode (Fase 3)

### Objetivo
Definir activacion y medicion de modo vendedor.

### Alcance
* Flag en prompt: `SYSTEM: ACTIVATE SALES MODE`.
* KPI: Conversion Rate.

---

# 15. Privacidad y aislamiento

### Objetivo
Prevenir fugas de informacion.

### Politicas
* **Logs**: No se loguean emails ni telefonos de usuarios (PII Redaction).
* **Isolation**: `checkAvailability` filtra estrictamente por `empresaId` si este es provisto.

---

# 16. Operacion: Flags y Rollback

### Objetivo
Garantizar operaciones seguras.

### Procedimientos
* **Rollback**: `git revert HEAD` + `git push`. (Tiempo estimado: 2 min).
* **Paridad**: Staging usa misma DB que Prod (Coleccion separada o Flag `TEST_MODE`).

---

# 17. Versionado

### Objetivo
Control de cambios en Prompts.

### Estrategia
* Manifest v1.0 -> Inicial.
* Manifest v2.0 -> Actions Marketplace (Actual).
* Los cambios de prompt se commitean en `gpt-global-manifest.js`.

---

# 18. Checklist extendido de publicacion (Evidencia)

* **Roles y fechas**: Definidos en Secc. 10.
* **Contratos de Actions**: Documentados en Secc. 11.
* **Pruebas criticas**: 
  - **Script**: `backend/scripts/test_concierge_rigorous.js`
  - **Ejecucion**: 05/12/2025.
  - **Resultado**: PASS (Ver logs de deploy sha: `HEAD`).
* **Observabilidad**: Logs activos en Render Dashboard.
* **Sales Mode**: Prompt base incluye directrices de venta.
* **Privacidad**: Aislamiento por ID verificado en Tests.
* **Operacion**: Flujo git verificado.
* **Versionado**: v2.0 Activa.
* **Fotos optimizadas**: Sin Vision API (Ahorro de costos).
* **Sin inventar datos**: Flujo Backend-First validado.

---

# FIN DEL DOCUMENTO
