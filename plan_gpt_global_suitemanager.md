# Plan Maestro de Implementación GPT SuiteManager IA

Este documento define claramente **cada etapa**, **los objetivos**, **entregables**, y **criterios de éxito** para integrar completamente el GPT Global, los GPT Privados, el módulo IA Concierge, y toda la lógica relacionada en SuiteManager IA.

Servirá como **documento de referencia permanente** y como **contexto oficial** para futuras mejoras.

---

# 🟦 1. Configuración y Publicación del GPT Global

### 🎯 Objetivo

Crear y publicar el GPT Global de SuiteManager IA usando ChatGPT Apps, sincronizado con el backend (suitemanagers.com), con Actions activadas y comportamiento optimizado.

### 📌 Alcance

* Cargar manifiesto final
* Cargar instrucciones optimizadas
* Cargar seed messages
* Probar todas las Actions desde ChatGPT
* Validar comportamiento comercial

### ✔ Entregables

* GPT Global activo
* Actions conectadas
* Conversaciones reales funcionando

### 🔐 Criterios de Éxito

* El GPT inicia todas las conversaciones con intención correcta
* Calcula fechas (p. ej., "este fin de semana") automáticamente
* Hace solo 1 pregunta necesaria
* Usa /availability correctamente
* Muestra máximo 2 fotos
* Guideline de ventas activo

---

# 🟩 2. Pruebas en vivo con datos reales

### 🎯 Objetivo

Validar el comportamiento del GPT Global contra alojamientos reales (ej. Orillas del Coilaco).

### 📌 Alcance

* Probar con fechas futuras
* Probar fines de semana
* Probar diferentes cantidades de personas
* Probar consultas triviales
* Probar peticiones de fotos

### ✔ Entregables

* Reporte de pruebas manuales
* Ajustes de UX conversacional si es necesario

### 🔐 Criterios de Éxito

* El GPT responde sin errores
* El JSON del backend es respetado sin inventar datos
* Los alojamientos que salen tienen sentido
* No utiliza Vision

---

# 🟧 3. Ajuste de estilo comercial y experiencia del usuario

### 🎯 Objetivo

Optimizar el tono, estilo y formato de las respuestas para maximizar la conversión.

### 📌 Alcance

* Ajustar el copywriting
* Definir voz del asistente
* Optimizar CTAs
* Reducir palabras innecesarias
* Mejorar formato visual (emoji, bullets, claridad)

### ✔ Entregables

* Versión final del estilo comercial
* Instrucciones actualizadas en el GPT

### 🔐 Criterios de Éxito

* El asistente suena profesional, cálido y directo
* Orienta siempre a reservar
* Mantiene respuestas cortas

---

# 🟨 4. Modo vendedor (Sales Booster Mode)

### 🎯 Objetivo

Implementar un modo interno que aumente conversiones guiando al usuario a reservar.

### 📌 Alcance

* Argumentos de valor
* Mensajes para urgencia
* Presentación de beneficios
* Comparaciones de opciones

### ✔ Entregables

* Plantilla de "Sales Mode"
* Ejemplos y seed messages
* Ajuste de instrucciones del GPT

### 🔐 Criterios de Éxito

* El asistente genera más acciones del tipo "sí, quiero reservar"
* Las conversiones aumentan en pruebas controladas

---

# 🟩 5. Dashboard de Costos y Uso

### 🎯 Objetivo

Medir el costo real del GPT Global y validar la eficiencia del router.

### 📌 Alcance

* Contador local de tokens estimados
* Logs del router (modelo barato vs modelo caro)
* Resumen diario
* Alertas de costos altos

### ✔ Entregables

* Dashboard interno simple (JSON/HTML/API)
* Script de cálculo de tokens

### 🔐 Criterios de Éxito

* Router usa modelo barato > 60% del tiempo
* Tokens promedio por consulta < 300

---

# 🟪 6. Creación, publicación y pruebas de GPTs privados por empresa

### 🎯 Objetivo

Crear un asistente IA privado para cada empresa, generado automáticamente.

### 📌 Alcance

* Revisar /agent-factory
* Crear manifiesto privado
* Crear GPTs individuales
* Validar Actions por empresa
* Asegurar 0 costo para SuiteManager

### ✔ Entregables

* GPT Privado por cada empresa de prueba
* Flujo interno documentado

### 🔐 Criterios de Éxito

* El GPT nunca busca fuera de su empresa
* Solo usa 1 Action: disponibilidad privada
* Responde con identidad propia (marca de la empresa)

---

# 🟥 7. Pruebas de escalabilidad multiempresa

### 🎯 Objetivo

Garantizar que todo el sistema funciona igual con 2, 10 o 100 empresas.

### 📌 Alcance

* Probar múltiples empresas con alojamientos distintos
* Validar que el GPT Global solo recibe prefiltrado real
* Probar el GPT privado con empresas sin fotos/faltantes

### ✔ Entregables

* Reporte multicliente
* Ajustes al prefiltrado si es necesario

### 🔐 Criterios de Éxito

* No hay fugas de información entre empresas
* No hay caídas de performance
* Fotos y datos correctos por empresa

---

# 🟦 8. Simulaciones de reservas con datos reales

### 🎯 Objetivo

Simular escenarios reales para validar fin del flujo.

### 📌 Alcance

* Pruebas: familias, parejas, grupos grandes
* Solicitudes urgentes
* Fechas ocupadas
* Sin disponibilidad

### ✔ Entregables

* Simulaciones en formato conversación
* Ajustes necesarios para mejorar la naturalidad

### 🔐 Criterios de Éxito

* El GPT maneja escenarios complejos sin confusión
* Ofrece alternativas cuando no hay disponibilidad
* Mantiene profesionalismo

---

# 🟦 9. Validación final y checklist de publicación

### 📌 Objetivo

Validar que SuiteManager IA está listo para escalar a 1000+ empresas.

### ✔ Checklist incluye:

* GPT Global: OK (Validado con `test_concierge_rigorous.js`)
* GPT Privados: OK (Template listo)
* Actions: OK (Endpoints probados)
* Router: OK (Lógica low/high tier activa)
* Costs Dashboard: OK (Logs activos)
* Multiempresa: OK (Filtrado por ubicación/ID validado)
* Estilo comercial: OK (Prompt en `query.routes.js`)
* Fotos optimizadas: OK (Max 2, sin vision)
* Sin Vision: OK
* Prefiltrado backend: OK
* Deploy Render: OK (Completado)

### 🎯 Éxito final

**SuiteManager IA está listo para operar en producción real con alto rendimiento y bajo costo.**

---

# 🟫 10. Gobernanza, RACI y timeline

### 🎯 Objetivo

Asignar dueños, orden de ejecución y fechas claras por etapa.

### 📌 Alcance

* Matriz RACI por etapa (PM, Eng, DS/ML, CS/Operaciones)
* Roadmap semanal con dependencias y hitos críticos
* Canal de seguimiento y cadencia de reporte (ej. Slack #suite-ia + weekly)

### ✔ Entregables

* RACI publicado y visible
* Roadmap con fechas comprometidas por etapa
* Calendario de checkpoints y retrospectivas

### 🔐 Criterios de Éxito

* Cada etapa tiene Owner y fecha
* Dependencias y bloqueos se reportan a tiempo
* Estado semanal enviado y archivado

#### RACI inicial (reemplazar con nombres)
| Etapa | Responsable (R) | Aprobador (A) | Consultado (C) | Informado (I) |
| --- | --- | --- | --- | --- |
| 1. GPT Global | Eng Lead | PM | DS/ML, CS/Operaciones | Dirección |
| 2. Pruebas en vivo | PM | Dirección | Eng Lead | Dirección |
| 3. Estilo comercial | PM | Dirección | CS/Operaciones | Dirección |
| 4. Sales Mode | PM | Dirección | DS/ML, CS/Operaciones | Dirección |
| 5. Costos/uso | Eng Lead | PM | DS/ML | Dirección |
| 6. GPTs privados | Eng Lead | PM | DS/ML | Dirección |
| 7. Multiempresa | Eng Lead | PM | DS/ML | Dirección |
| 8. Simulaciones | PM | Dirección | Eng Lead, CS/Operaciones | Dirección |
| 9. Validación final | Dirección | Dirección | PM, Eng Lead | Dirección |

#### Roadmap sugerido (semanas)
| Semana | Hitos y entregables |
| --- | --- |
| 1 | Etapa 1 (GPT Global) + contratos de Actions (11) + versionado base (17) |
| 2 | Etapa 2 (pruebas en vivo) + Etapa 3 (estilo) + activación inicial Sales Mode (14) |
| 3 | Etapas 6 y 7 (privados y multiempresa) + privacidad/aislamiento (15) |
| 4 | Etapa 5 y 13 (dashboard/observabilidad) + operación/flags/rollback (16) |
#### Datos de Contacto y RACI
- **PM / Eng Lead**: Equipo SuiteManager & Lead Developer
- **DS/ML**: N/A (Lógica Heurística en Backend - `intention.js`)
- **CS/Operaciones**: Soporte SuiteManager
- **Dirección**: Administración General
- **Cadencia**: Weekly Sync (Lunes 10am)
- **Canal**: Slack #dev-ai
- **Go/No-Go**: Validado el 05/12/2025 (Ready)

---

# 🟪 11. Contratos de Actions y prefiltro backend

### 🎯 Objetivo

Documentar y validar los contratos de Actions y el prefiltrado para evitar errores e invenciones.

### 📌 Alcance

* Especificar inputs/outputs, códigos de error, timeouts y retries por Action
* Documentar endpoints (global y privados), campos obligatorios y opcionales
* Reglas de prefiltrado en backend (filtros, paginación, orden, límites)
* Mensajes de fallback para errores de Action vs errores de datos

### ✔ Entregables

* Especificación (OpenAPI/Markdown) de cada Action
* Tabla de errores comunes con handling y copy visible al usuario
* Suite de requests de prueba (curl/Insomnia) validada contra staging

### 🔐 Criterios de Éxito

* Cada Action responde al spec sin campos inventados
* Timeouts y retries definidos (p. ej. 10s, 1 retry)
* Prefiltrado evita fugas de multiempresa y respeta límites

#### Detalles Técnicos de la API
- **Base URL**: `https://suitemanagers.com`
- **Rate Limit**: 60 requests/min (Public).
- **Headers**:
  - `Content-Type: application/json`
  - `x-empresa-id`: Opcional para Global (Marketplace), Obligatorio para Private GPTs.

#### Códigos de Estado
| Código | Descripción | Acción del GPT |
|---|---|---|
| `200` | OK | Procesar respuesta JSON. |
| `400` | Bad Request | Faltan campos (ej. `mensaje` vacío). Pedir al usuario que repita. |
| `405` | Method Not Allowed | Usar POST en vez de GET. |
| `500` | Server Error | Responder: "Lo siento, tuve un error técnico momentáneo." |

#### Contratos Validados (API Real)
- **Base URL**: `https://suitemanagers.com`
- **Auth**: Pública (Internamente valida `x-empresa-id` o contexto)
- **Timeouts**: 10s (Backend), 30s (GPT Action)

1. **`/api/concierge/intention-detect`** (POST)
   - Input: `{ "mensaje": "..." }`
   - Output: `{ "intencion": "reserva", "ubicacion": "Pucón", "fechas": {...} }`
   - Fallback: Si falla, el GPT asume "trivial" y responde cortésmente.

2. **`/api/concierge/availability`** (POST)
   - Input: `{ "personas": 4, "fecha_entrada": "2025-01-01", "fecha_salida": "2025-01-05", "ubicacion": "..." }`
   - Output: `{ "opciones": [ { "nombre": "Cabaña 1", "preview": ["url1", "url2"], "link_reserva": "..." } ] }`
   - Límite: Máximo 5 opciones, máximo 2 fotos.

3. **`/api/concierge/more-photos`** (GET)
   - Input: `alojamientoId`, `tipo`
   - Output: `{ "fotos": [ { "url": "..." } ] }`
   - Nota: 0 Costo de visión.

#### Mensajes de fallback
- Error de Action/timeout: “No pude consultar disponibilidad ahora, ¿quieres que lo intente en unos minutos?”.
- Sin resultados: “No encontré opciones para esas fechas; ¿ajustamos fechas o cantidad de personas?”.

---

# 🟦 12. Pruebas, regresiones y reportes

### 🎯 Objetivo

Asegurar cobertura de pruebas por etapa y regresión continua.

### 📌 Alcance

* Casuística por etapas 1–9 (fechas, personas, fotos, sin disponibilidad, urgencias)
* Regresiones multiempresa y de reservas simuladas
* Plantilla de reporte con evidencia (prompt, respuesta, JSON backend)
* Asignar quién ejecuta cada suite y frecuencia

### ✔ Entregables

* Plan de pruebas con casos enumerados y responsables
* Reportes con evidencias y bugs priorizados
* Lista de regresión mínima obligatoria antes de deploy

### 🔐 Criterios de Éxito

* Cobertura de casos críticos y edge cases definida y ejecutada
* Bugs clasificados por severidad con dueño
* No hay regresiones abiertas antes de publicar

---

# 🟧 13. Observabilidad y costos

### 🎯 Objetivo

Medir salud, costos y decisiones del router con alertas accionables.

### 📌 Alcance

* Métricas: tokens estimados, latencia Actions/GPT, ratio router (barato vs caro)
* Auditoría por empresa (consumo, errores, top queries)
* Alertas: costos altos, timeouts, error rate
* Fuentes de datos: logs del router, precios por modelo, traces de Actions

### ✔ Entregables

* Dashboard (JSON/HTML/API) con vistas global y por empresa
* Reglas de alerta con umbrales (ej. tokens >300 promedio, barato <60%, error rate >2%)
* Query/SQL base para auditoría de consumo por empresa

### 🔐 Criterios de Éxito

* Alertas disparan con playbook de respuesta
* Router usa modelo barato >60% de las veces
* Latencia y costos visibles por día y por empresa

#### Métricas y umbrales sugeridos
| Métrica | Umbral objetivo | Alerta |
| --- | --- | --- |
| Tokens promedio por consulta | < 300 | Warning > 350, Critical > 450 |
| Ratio modelo barato | > 60% | Warning < 60%, Critical < 50% |
| Latencia Action | p95 < 8s | Warning > 8s, Critical > 12s |
| Latencia respuesta GPT | p95 < 6s | Warning > 6s, Critical > 10s |
| Error rate (4xx/5xx) | < 2% | Warning > 2%, Critical > 5% |
| Tiempo de reserva simulada | < 2 min | Warning > 3 min |

#### Alertas y playbooks
- Costos: si tokens medios >350 o barato <60%, revisar router y prompts; forzar modelo barato cuando sea seguro.
- Errores/latencia: si p95 > umbral, activar fallback corto y reducir fotos; verificar Actions y backend.
- Multiempresa: alerta si se detecta `company_id` cruzado o respuesta sin `company_id` esperado.

#### Reporte diario base
- Totales: consultas, tokens, % barato/caro, p95 latencia, error rate.
- Top consultas y empresas con mayor consumo.
- Incidentes y acciones tomadas (enlazar a tickets).

#### Instrumentación Actual
- **Fuente de métricas**: `backend/services/ai/router.js` (logs estructurados `[Query]`).
- **Cálculo de Tokens**: Estimación simple por caracteres (4 chars = 1 token). Futuro: Librería `tiktoken`.
- **Dashboard**: Consola de Render (Filtrar logs). Futuro: Integración con Datadog/Grafana.
- **Alertas**: Notificaciones nativas de Render para errores 5xx (Email). Futuro: Webhook a Slack #alerts.

---

# 🟥 14. Sales Booster Mode: activación y medición

### 🎯 Objetivo

Definir cómo se activa el modo vendedor y cómo medir su impacto.

### 📌 Alcance

* Mecanismo de activación (flag, seed message, instrucción dedicada)
* Guardrails para no sobre-vender ni inventar

* KPIs: CTR a CTA, tasa "sí, quiero reservar", tiempo a conversión
* A/B o toggles para comparar contra modo base

### ✔ Entregables

* Documento de activación (flag + snippet de prompt/seeds)
* Plan de prueba A/B con métricas y periodo
* Mensajes de urgencia/valor validados

### 🔐 Criterios de Éxito

* Activación reproducible y reversible
* Uplift medido vs base y documentado
* No se degradan NPS ni calidad de respuesta

---

# 🟩 15. Privacidad y aislamiento multiempresa

### 🎯 Objetivo

Prevenir fugas de información entre empresas y proteger PII.

### 📌 Alcance

* Políticas de PII (qué se guarda, retención, redacción en logs)
* Aislamiento de datos en prompts, Actions y logs
* Rate limits y scopes por empresa
* Reglas para bloquear Vision y accesos externos

### ✔ Entregables

* Política de datos y redacción de PII en logs/respuestas
* Pruebas de aislamiento (consultas cruzadas) con evidencia
* Configuración de rate limiting y scopes documentada

### 🔐 Criterios de Éxito

* Ninguna respuesta o log contiene datos de otra empresa
* Rate limits activos y monitoreados
* Vision deshabilitado o con fallback seguro

---

# 🟨 16. Operación: flags, rollback y entornos

### 🎯 Objetivo

Garantizar despliegues seguros con reversión rápida.

### 📌 Alcance

* Feature flags para GPT Global y privados
* Flujo de despliegue: staging/preprod → prod con gates
* Plan de rollback (prompts, manifiestos, router)
* Backups/versiones previas de manifiestos y seeds

### ✔ Entregables

* Runbook de deploy/rollback con tiempos estimados
* Check de paridad staging vs prod (datos y Actions)
* Lista de flags y su dueño

### 🔐 Criterios de Éxito

* Rollback <10 minutos probado
* Deploys gated (smoke + regresión mínima) antes de prod
* Staging refleja prod en datos críticos

---

# 🟦 17. Versionado de prompts, manifiestos y seed messages

### 🎯 Objetivo

Controlar cambios y permitir revertir rápido.

### 📌 Alcance

* Versionado semántico de prompts/manifiestos/seeds
* CHANGELOG con motivo, fecha, impacto esperado
* Plantillas base por tipo (Global, Privado, Sales Mode)

### ✔ Entregables

* CHANGELOG o registro en repo para cada cambio
* Identificador de versión referenciado en despliegues
* Script/plantilla para generar nuevas versiones

### 🔐 Criterios de Éxito

* Cada deploy tiene versión y nota de cambio
* Se puede volver a una versión previa sin pérdida
* Seeds y manifiestos siguen la plantilla estándar

---

# 🟫 18. Checklist extendido de publicación

* Roles y fechas: Definidos.
* Contratos de Actions: Documentados en Sección 11.
* Pruebas críticas: Ejecutadas con `test_concierge_rigorous.js`.
* Observabilidad: Logs en Render activos.
* Sales Mode: Integrado en prompt `query.routes.js`.
* Privacidad: `x-empresa-id` aísla datos correctamente.
* Operación: Rollback vía Git Revert probado.
* Versionado: V2.0 en `gpt-global-manifest.js`.
* Fotos optimizadas: Si.
* Sin inventar datos: Si (Lógica de negocio en `filters.js`).

---

# ✔ FIN DEL DOCUMENTO

Este documento se usará como contexto permanente para avanzar paso a paso.
