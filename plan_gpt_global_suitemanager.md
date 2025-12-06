# Plan Maestro de Implementacion GPT SuiteManager IA

Este documento define claramente **cada etapa**, **los objetivos**, **entregables**, y **criterios de exito** para integrar completamente el GPT Global, los GPT Privados, el modulo IA Concierge, y toda la logica relacionada en SuiteManager IA.

Servira como **documento de referencia permanente** y como **contexto oficial** para futuras mejoras.

---

# 1. Configuracion y Publicacion del GPT Global

### Objetivo

Crear y publicar el GPT Global de SuiteManager IA usando ChatGPT Apps, sincronizado con el backend (suitemanagers.com), con Actions activadas y comportamiento optimizado.

### Alcance

* Cargar manifiesto final
* Cargar instrucciones optimizadas
* Cargar seed messages
* Probar todas las Actions desde ChatGPT
* Validar comportamiento comercial

### Entregables

* GPT Global activo
* Actions conectadas
* Conversaciones reales funcionando

### Criterios de Exito

* El GPT inicia todas las conversaciones con intencion correcta
* Calcula fechas (p. ej., "este fin de semana") automaticamente
* Hace solo 1 pregunta necesaria
* Usa /availability correctamente
* Muestra maximo 2 fotos
* Guideline de ventas activo

---

# 2. Pruebas en vivo con datos reales

### Objetivo

Validar el comportamiento del GPT Global contra alojamientos reales (ej. Orillas del Coilaco).

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

* El asistente genera mas acciones del tipo "si, quiero reservar"
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

# 6. Creacion, publicacion y pruebas de GPTs privados por empresa

### Objetivo

Crear un asistente IA privado para cada empresa, generado automaticamente.

### Alcance

* Revisar /agent-factory
* Crear manifiesto privado
* Crear GPTs individuales
* Validar Actions por empresa
* Asegurar 0 costo para SuiteManager

### Entregables

* GPT Privado por cada empresa de prueba
* Flujo interno documentado

### Criterios de Exito

* El GPT nunca busca fuera de su empresa
* Solo usa 1 Action: disponibilidad privada
* Responde con identidad propia (marca de la empresa)

---

# 7. Pruebas de escalabilidad multiempresa

### Objetivo

Garantizar que todo el sistema funciona igual con 2, 10 o 100 empresas.

### Alcance

* Probar multiples empresas con alojamientos distintos
* Validar que el GPT Global solo recibe prefiltrado real
* Probar el GPT privado con empresas sin fotos/faltantes

### Entregables

* Reporte multicliente
* Ajustes al prefiltrado si es necesario

### Criterios de Exito

* No hay fugas de informacion entre empresas
* No hay caidas de performance
* Fotos y datos correctos por empresa

---

# 8. Simulaciones de reservas con datos reales

### Objetivo

Simular escenarios reales para validar fin del flujo.

### Alcance

* Pruebas: familias, parejas, grupos grandes
* Solicitudes urgentes
* Fechas ocupadas
* Sin disponibilidad

### Entregables

* Simulaciones en formato conversacion
* Ajustes necesarios para mejorar la naturalidad

### Criterios de Exito

* El GPT maneja escenarios complejos sin confusion
* Ofrece alternativas cuando no hay disponibilidad
* Mantiene profesionalismo

---

# 9. Validacion final y checklist de publicacion

### Objetivo

Validar que SuiteManager IA esta listo para escalar a 1000+ empresas.

### Checklist incluye:

* GPT Global: OK (Validado con `test_concierge_rigorous.js`)
* GPT Privados: OK (Template listo)
* Actions: OK (Endpoints probados)
* Router: OK (Logica low/high tier activa)
* Costs Dashboard: OK (Logs activos)
* Multiempresa: OK (Filtrado por ubicacion/ID validado)
* Estilo comercial: OK (Prompt en `query.routes.js`)
* Fotos optimizadas: OK (Max 2, sin vision)
* Sin Vision: OK
* Prefiltrado backend: OK
* Deploy Render: OK (Completado)

### Exito final

**SuiteManager IA esta listo para operar en produccion real con alto rendimiento y bajo costo.**

---

# 10. Gobernanza, RACI y timeline

### Objetivo

Asignar dueños, orden de ejecucion y fechas claras por etapa.

### Datos de Contacto y RACI
- **PM / Eng Lead**: Equipo SuiteManager & Lead Developer
- **DS/ML**: N/A (Logica Heuristica en Backend - `intention.js`)
- **CS/Operaciones**: Soporte SuiteManager
- **Direccion**: Administracion General
- **Cadencia**: Weekly Sync (Lunes 10am)
- **Canal**: Slack #dev-ai
- **Go/No-Go**: Validado el 05/12/2025 (Ready)

---

# 11. Contratos de Actions y prefiltro backend

### Objetivo

Documentar y validar los contratos de Actions y el prefiltrado para evitar errores e invenciones.

### Detalles Tecnicos de la API
- **Base URL**: `https://suitemanagers.com`
- **Rate Limit**: 60 requests/min (Public).
- **Headers**:
  - `Content-Type: application/json`
  - `x-empresa-id`: Opcional para Global (Busqueda Marketplace), Obligatorio para Private GPTs (Aislamiento de Tenant).

### Codigos de Estado y Manejo de Errores
| Codigo | Descripcion | Accion del GPT |
|---|---|---|
| `200` | OK | Procesar respuesta JSON. |
| `400` | Bad Request | Faltan campos (ej. `mensaje` vacio). Pedir al usuario que repita. |
| `404` | Not Found | Sin resultados. Responder: "No encontre disponibilidad en esas fechas. ¿Cambiamos algo?" |
| `405` | Method Not Allowed | Usar POST en vez de GET. |
| `408` | Request Timeout | El backend tardo demasiado. Responder: "Demora tecnica, reintentando..." |
| `429` | Too Many Requests | Pausar y reintentar en 5s. |
| `500` | Server Error | Responder: "Lo siento, tuve un error tecnico momentaneo." |

### Contratos Validados (API Real)

1. **`/api/concierge/intention-detect`** (POST)
   - Input: `{ "mensaje": "..." }`
   - Output: `{ "intencion": "reserva", "ubicacion": "Pucon", "fechas": {...} }`
   - Fallback: Si falla, el GPT asume "trivial" y responde cortesmente.

2. **`/api/concierge/availability`** (POST)
   - Input: `{ "personas": 4, "fecha_entrada": "2025-01-01", "fecha_salida": "2025-01-05", "ubicacion": "..." }`
   - Output: `{ "opciones": [ { "nombre": "Cabaña 1", "preview": ["url1", "url2"], "link_reserva": "..." } ] }`
   - Limites Backend: Maximo 5 opciones retornadas, Maximo 2 fotos por opcion (truncado automatico).

3. **`/api/concierge/more-photos`** (GET)
   - Input: `alojamientoId`, `tipo`
   - Output: `{ "fotos": [ { "url": "..." } ] }`
   - Nota: 0 Costo de vision. Maximo 10 URLs.

---

# 12. Pruebas, regresiones y reportes

### Objetivo

Asegurar cobertura de pruebas por etapa y regresion continua.

### Alcance

* Casuistica por etapas 1-9 (fechas, personas, fotos, sin disponibilidad, urgencias)
* Regresiones multiempresa y de reservas simuladas
* Plantilla de reporte con evidencia (prompt, respuesta, JSON backend)
* Asignar quien ejecuta cada suite y frecuencia

### Entregables

* Plan de pruebas con casos enumerados y responsables
* Reportes con evidencias y bugs priorizados
* Lista de regresion minima obligatoria antes de deploy

### Criterios de Exito

* Cobertura de casos criticos y edge cases definida y ejecutada
* Bugs clasificados por severidad con dueño
* No hay regresiones abiertas antes de publicar

---

# 13. Observabilidad y costos

### Objetivo

Medir salud, costos y decisiones del router con alertas accionables.

### Instrumentacion y Alertas

| Componente | Herramienta Actual | Herramienta Objetivo (Fase 3) |
|---|---|---|
| **Metricas** | Console Logs (`[Query]`) | Prometheus/Datadog via API Gateway |
| **Tokens** | Estimacion (4 chars = 1 token) | Libreria `tiktoken` en backend |
| **Dashboard** | Render Console Logs | Grafana Dashboard |
| **Alertas** | Email (Render Native 5xx) | Slack Webhook (#alerts-suiteia) |

**Umbrales Actuales:**
- **Latencia Critica**: > 10s (Logs muestran timeout)
- **Error Rate**: > 5% (Monitorizado manualmente en deploy)

---

# 14. Sales Booster Mode: activacion y medicion

### Objetivo

Definir como se activa el modo vendedor y como medir su impacto.

### Alcance

* Mecanismo de activacion (flag, seed message, instruccion dedicada)
* Guardrails para no sobre-vender ni inventar
* KPIs: CTR a CTA, tasa "si, quiero reservar", tiempo a conversion
* A/B o toggles para comparar contra modo base

### Entregables

* Documento de activacion (flag + snippet de prompt/seeds)
* Plan de prueba A/B con metricas y periodo
* Mensajes de urgencia/valor validados

### Criterios de Exito

* Activacion reproducible y reversible
* Uplift medido vs base y documentado
* No se degradan NPS ni calidad de respuesta

---

# 15. Privacidad y aislamiento multiempresa

### Objetivo

Prevenir fugas de informacion entre empresas y proteger PII.

### Alcance

* Politicas de PII (que se guarda, retencion, redaccion en logs)
* Aislamiento de datos en prompts, Actions y logs
* Rate limits y scopes por empresa
* Reglas para bloquear Vision y accesos externos

### Entregables

* Politica de datos y redaccion de PII en logs/respuestas
* Pruebas de aislamiento (consultas cruzadas) con evidencia
* Configuracion de rate limiting y scopes documentada

### Criterios de Exito

* Ninguna respuesta o log contiene datos de otra empresa
* Rate limits activos y monitoreados
* Vision deshabilitado o con fallback seguro

---

# 16. Operacion: flags, rollback y entornos

### Objetivo

Garantizar despliegues seguros con reversion rapida.

### Alcance

* Feature flags para GPT Global y privados
* Flujo de despliegue: staging/preprod -> prod con gates
* Plan de rollback (prompts, manifiestos, router)
* Backups/versiones previas de manifiestos y seeds

### Entregables

* Runbook de deploy/rollback con tiempos estimados
* Check de paridad staging vs prod (datos y Actions)
* Lista de flags y su dueño

### Criterios de Exito

* Rollback <10 minutos probado
* Deploys gated (smoke + regresion minima) antes de prod
* Staging refleja prod en datos criticos

---

# 17. Versionado de prompts, manifiestos y seed messages

### Objetivo

Controlar cambios y permitir revertir rapido.

### Alcance

* Versionado semantico de prompts/manifiestos/seeds
* CHANGELOG con motivo, fecha, impacto esperado
* Plantillas base por tipo (Global, Privado, Sales Mode)

### Entregables

* CHANGELOG o registro en repo para cada cambio
* Identificador de version referenciado en despliegues
* Script/plantilla para generar nuevas versiones

### Criterios de Exito

* Cada deploy tiene version y nota de cambio
* Se puede volver a una version previa sin perdida
* Seeds y manifiestos siguen la plantilla estandar

---

# 18. Checklist extendido de publicacion

* Roles y fechas: Definidos en Secc. 10.
* Contratos de Actions: Documentados en Secc. 11.
* Pruebas criticas: Ejecutadas (Ver `test_concierge_rigorous.js`).
* Observabilidad: Logs en Render activos (Secc. 13).
* Sales Mode: Integrado en prompt (`query.routes.js`).
* Privacidad: `x-empresa-id` aisla datos correctamente.
* Operacion: Rollback via Git Revert probado.
* Versionado: V2.0 en `gpt-global-manifest.js`.
* Fotos optimizadas: Si.
* Sin inventar datos: Si (Lógica backend `filters.js`).

---

# FIN DEL DOCUMENTO

Este documento se usara como contexto permanente para avanzar paso a paso.
