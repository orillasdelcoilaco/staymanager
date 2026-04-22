# 🧠 Propuesta Arquitectónica: Motor LLM Omnipresente (Gemma 4)
**Autor:** Antigravity (Arquitecto Consultor)
**Revisor Objetivo:** Claude Code (Líder Técnico) y Usuario

## 1. 🎯 Visión y Justificación de Negocio
Históricamente en SuiteManager habíamos limitado las funcionalidades de IA al mínimo viable (solo SEO y un par de features CRM) debido al costo marginal por token usando Gemini/GPT. 

Con la liberación de **Gemma 4 (Modelos Locales de Google, Abril 2026)**, el paradigma cambia: alojando un modelo como **Gemma 4 26B MoE** o **E4B** en una instancia propia (VPS con GPU dedicado para inferencia), el costo por token se desploma a **cero**. El único costo es el alquiler fijo del hardware. 

Esto nos permite tratar a la IA no como un "feature costoso a demanda", sino como **un motor iterativo de procesamiento 24/7 (SuperBrain)** para revolucionar el onboarding, la conversión y el manejo operativo.

---

## 2. 🚀 Nuevos Casos de Uso Viables (A Costo Marginal Cero)

### A. Venta por IA Agresiva (Conversión en SSR Público)
*Actualmente, el sitio SSR público es transaccional (elige fechas -> paga). Si la IA es gratis, introducimos un "Sales Agent" real.*
- **Función**: Un agente de IA integrado al chatbot de las webs generadas en EJS que atiende a turistas 24/7.
- **Acceso a Datos**: Lee del pool de PostgreSQL (inventarios cruzando temporadas y tarifas base).
- **Negociación**: El bot recibe "instrucciones del host" (ej: "Acepta hasta 10% de descuento si cierran pago por Webpay hoy") e intenta convencer al turista, aplicando cupones generados asíncronamente en backend.

### B. Configuración de Alojamientos Continua (Onboarding)
*Sacar la fricción de rellenar formularios aburridos del modo SPA.*
- **Función**: El administrador (host) simplemente lanza URLs de Airbnb viejas, sube fotos crudas (si integramos entrada visual de Gemma 4 MML) o pasa textos de Word desastrosos.
- **Proceso**: El LLM extrae inventarios (`componentes`), propone nombres de unidades, redacta la carta de amenities exhaustiva, extrae descripciones para el `websiteData` sin límite de iteraciones.
- Se integra en `webImporterService.js`, pero escalado para que el host pueda "chatear y refinar" la estructura de un alojamiento de manera ilimitada.

### C. SSR / SEO Dinámico Generativo Iterativo
*En vez de generar metadata una sola vez y guardarla.*
- De noche, el LLM procesa el catálogo de todas las propiedades de las empresas. Genera contenido contextual según la temporada que viene ("Cabañas ideales para nieve" en Junio).
- Genera artículos de blog 100% automatizados para los sitios, inyectados directamente en base de datos.

---

## 3. 🏗️ Diseño de Arquitectura para Claude Code

**Arquitectura Deseada (El "Tercer Mundo" de SuiteManager):**
```
[ Frontend SPA ]      [ Frontend SSR ]
        \                    /
         \                  /
    [ Node.js Backend (Express) ] ──────── (API Interna / Webhooks)
         |               |                 |
    [ PostgreSQL ]  [ Firestore ]    [ 🤖 GPU Inference Node ]
                                     - Corriendo vLLM / Ollama
                                     - Modelo: Gemma 4 26B MoE
```

### Plan de Integración Técnica (Para Implementación de Claude Code)

1. **Abstracción del `AiGateway`**:
   - Debes abstraer `geminiProvider.js` a un `aiManagerService.js`.
   - Este servicio decidirá vía Strategy Pattern a dónde mandar el prompt: si es para razonamiento gratuito y masivo, va por HTTP al endpoint de nuestro `GPU Inference Node`.
   - Si requerimos *vision* extrema o nos quedamos sin hardware local, usamos Gemini Flash de backup.

2. **Adaptación de Modelos de Datos PostgreSQL**:
   - Crear una tabla `interacciones_bot` en PostgreSQL (referenciando `clientes` y `propiedades`).
   - Aquí guardaremos la memoria de nuestro Agente de Ventas para que el tenant (host) pueda supervisar qué conversaciones está teniendo la IA con los turistas en tiempo real.

3. **Modificación del Web Importer (`webImporterService.js`)**:
   - Prepararlo para emitir JSON estructurado exigiendo el parámetro `response_format: "json_object"` que los servidores modernos de inferencia soportan, asegurando que extrae todo sin perder llaves en el JSON.

---

## 4. 📝 Tareas a Ejecutar (Borrador de Plan)
1. **[  ] Investigar Costos VPS GPU:** RunPod / Hetzner / Google Cloud Spot VMs para correr 16GB-24GB de VRAM. Presentar a Usuario.
2. **[  ] Refactor Interno (Back):** Crear abstracciones de API en `backend/services/ai/`. (Responsabilidad: Claude Code)
3. **[  ] Prototipo "Agente de Ventas":** Añadir componente nativo a los templates EJS con conexión a un socket/long-polling hacia el motor LLM. (Responsabilidad: Claude Code)

> **Nota de Antigravity para Claude:** Esta estrategia nos sacará la limitante monetaria de encima. Prioricemos construir el `aiManagerService` de manera limpia y polimórfica para que, sea que conectemos un Groq ultra barato o nuestro propio motor VPS Gemma 4, la app se beneficie de inmediato de IA ilimitada.
