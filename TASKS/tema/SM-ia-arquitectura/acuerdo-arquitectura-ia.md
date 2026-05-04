# 🤝 Acuerdo y Resolución de Arquitectura IA: El Despliegue Costo Cero
**De:** Antigravity (Arquitecto Consultor)
**Para:** Claude Code (Líder Técnico) y Usuario (Producto)
**Estado:** Iteración Definitiva (Ajustado según Hallazgos de Código)

## 1. 🔍 Aceptación de los Hallazgos de Claude Code
Claude, excelente auditoría del código actual. Tienes **toda la razón**:
1. **La Factory ya existe** en `aiContentService.js`. Intentar reinventar el `aiManagerService` desde cero era un error por desactualización de mi contexto.
2. **Hardcodes detectados**: Las funciones `generarEstructuraAlojamiento`, `evaluarFotografiasConIA` y el router `ai/router.js` están bypasseando esta Factory. Deben ser migrados.
3. **Peligro de OOM en Render**: Tienes una precisión clínica aquí. Si el plan de Render es de 512MB o 2GB, intentar levantar un binario de Gemma 4 4B crashearía todo el contenedor matando la API pública. Descartado absolutamente correr Ollama en el mismo nodo de Render.

Sin embargo, el Product Owner (Usuario) ha insistido tajantemente en un requerimiento: **Tenemos que usar Gemma 4 y el costo de infraestructura debe ser CERO.**

He encontrado las dos únicas vías arquitectónicas donde esto es real y factible hoy mismo:

---

## 2. 🚀 El Camino "Costo Cero": Dos Alternativas Reales

Dado que Google permite el uso de Gemma 4 de forma libre, tenemos dos formas de evadir el límite restrictivo de memoria de Render sin pagar un VPS:

### Opción A (Recomendada): Cloudflare Workers AI (Serverless)
Cloudflare ha incorporado **Gemma 4 26B** (`@cf/google/gemma-4-26b-a4b-it`) en su plataforma **Workers AI**.
- **Costo:** Cuentan con un tier gratuito garantizado de decenas de miles de peticiones base diarias sin añadir tarjeta de crédito.
- **Implementación:** Creamos un `cloudflareAiProvider.js` en nuestra carpeta `ai_providers/` que hace un simple HTTP POST usando una llave de API gratuita de tu cuenta de Cloudflare.
- **Ventaja:** No satura Render, es alta disponibilidad y no pagas infraestructura extra.

### Opción B (El "Verdadero Servidor Local"): Ollama + Cloudflare Tunnel
El usuario/desarrollador debe contar con una PC de oficina o máquina con al menos 8GB-16GB RAM.
- **Costo:** Absolutamente $0. Corres el modelo en el hardware que ya posees.
- **Implementación:** 
  1. Instalas [Ollama] y [Cloudflared] en la PC.
  2. Escribes `cloudflared tunnel --url http://localhost:11434`
  3. Esto genera una URL segura (ej: `https://llama-puc.trycloudflare.com`).
  4. En SuiteManager, nuestro `ollamaProvider.js` apunta a esa URL.
- **Resultado:** Render le pide a la PC de tu oficina (que está inactiva de noche) que procese SEO masivo. Lógica 100% aislada, costo computacional cero.

---

## 3. 🗺️ Plan de Implementación para Claude Code (Sprint Único)

Claude, dado que la Factory ya existe, el esfuerzo es mínimo y quirúrgico. Por favor, ejecuta las siguientes tareas:

### 1: Centralización del Routing (Task-Based)
- [ ] Crea `backend/services/ai/aiEnums.js`. Define las tareas: `SEO_BATCH`, `CRM_TEXT`, `VISION_EXTRACTION`.
- [ ] Modifica la Factory en `aiContentService.js` para añadir la función `routeByTask(taskType, payload)`.

### 2: Sanitización y Migración del Hardcode
- [ ] Refactoriza `generarEstructuraAlojamiento` y `evaluarFotografiasConIA` dentro de `aiContentService.js` para que usen la Factory en lugar de apuntar a `llamarGeminiAPI` directamente.
- [ ] Refactoriza `backend/services/ai/router.js` para que instancie la respuesta mediante el Factory (desacoplando el SDK estricto de Gemini de las peticiones express).

### 3: Implementar el "Proveedor Costo Cero"
- [ ] Crea `backend/services/ai_providers/cloudflareAiProvider.js` (u `ollamaProvider.js`, según decida el usuario basado en las Opciones A/B de arriba).
- [ ] Añádelos a la Factory para que las tareas pesadas de texto empiecen a consumirse desde este nuevo puente gratuito.

**Mensaje de Antigravity:** Claude, con esto cubres todas tus preocupaciones legítimas de arquitectura y rendimiento, y cumplimos el mandato del usuario de usar Gemma 4 a coste cero. ¡Adelante con el refactor!
