# Resumen de Integración SuiteManager <-> ChatGPT

Este documento detalla la arquitectura y los componentes implementados para conectar SuiteManager con el ecosistema de IA de OpenAI (ChatGPT) y el Protocolo de Contexto de Modelo (MCP).

## 1. Arquitectura General

Hemos transformado SuiteManager en una plataforma "AI-Native" que expone sus funcionalidades tanto a usuarios humanos (Web) como a agentes de IA (API/MCP).

**Componentes Clave:**
*   **API Pública (OpenAPI):** Interfaz estándar para que la IA lea y escriba datos (reservas, propiedades).
*   **Servidor MCP (Model Context Protocol):** Un "cerebro" intermedio que permite a la IA descubrir herramientas y contexto dinámicamente.
*   **Sistema de Agentes:** Generación automática de personalidades y contextos para cada empresa registrada.

## 2. Componentes Implementados

### A. API Pública y Especificación
*   **OpenAPI Spec:** `openapi/openapi.json`
    *   Define endpoints para consultar disponibilidad, cotizar, ver propiedades y crear reservas.
    *   **Acceso:** `https://suite-manager.onrender.com/openapi.json`
    *   **Uso:** Permite a los GPTs personalizados entender qué puede hacer el sistema.

### B. Servidor MCP (Model Context Protocol)
*   **Ubicación:** `ai/openai/mcp-server/`
*   **Funcionalidad:**
    *   Actúa como un servidor de herramientas para la IA.
    *   **Herramienta `buscar_empresa`:** Permite al agente global identificar a qué empresa se refiere el usuario (ej: "Quiero ir a Hotel Los Andes") y cargar su contexto específico.
*   **Despliegue:**
    *   Se ejecuta como un subproceso dentro de la aplicación principal (Puerto 4002).
    *   Expuesto públicamente vía Proxy Inverso en `backend/index.js`.
    *   **Endpoint de Verificación:** `https://suite-manager.onrender.com/.well-known/ai-mcp`

### C. Automatización de Agentes (AI-Native)
*   **Generación al Registro:**
    *   Al crear una empresa (`authService.js`), se ejecuta `create-agent.js`.
    *   Esto crea un archivo de agente único: `ai/agentes/empresa/{id}.md` con instrucciones personalizadas.
*   **Router Inteligente:**
    *   `ai/router/empresaNameDetector.js`: Utilidad que busca en un índice JSON para matchear texto de usuario con IDs de empresas.

### D. Apps Premium y Empaquetado
*   **Trigger:** Subida de Logo (`backend/routes/empresa.js`).
*   **Acción:**
    *   Genera un `manifest.json` en `ai/agentes/empresa/{id}/app-package/`.
    *   Intenta registrar la App automáticamente en OpenAI (Script experimental `registerAppAttempt.js`).

## 3. Flujo de Usuario (Ejemplo)

1.  **Usuario:** "Hola, busco cabaña en Orillas del Coilaco".
2.  **ChatGPT (Global):** Consulta al **Servidor MCP** (`buscar_empresa`).
3.  **MCP:** Detecta "Orillas del Coilaco" -> ID `orillasdelcoilaco`.
4.  **MCP:** Devuelve las instrucciones del agente específico (`ai/agentes/empresa/orillasdelcoilaco.md`).
5.  **ChatGPT:** Cambia de personalidad a "Asistente de Orillas del Coilaco".
6.  **ChatGPT:** Usa la **API Pública** para buscar disponibilidad en ese ID específico.

## 4. Estado Actual
*   ✅ **Backend:** Desplegado y configurado con Proxy MCP.
*   ✅ **Automatización:** Activa en Registro y Subida de Logo.
*   ✅ **Conectividad:** Endpoints públicos accesibles.

---
**Próximos Pasos Recomendados:**
*   Validar el registro real de Apps en la plataforma de desarrolladores de OpenAI cuando liberen la API pública de "Apps".
*   Refinar las instrucciones del `agent-empresa-template.md` base.
