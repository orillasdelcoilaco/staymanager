/**
 * ollamaProvider.js — Proveedor Ollama para desarrollo local ÚNICAMENTE
 *
 * ⚠️ SOLO PARA USO LOCAL. No usar en producción (Render).
 * Ollama corre en la máquina del desarrollador en http://localhost:11434
 *
 * Para usar:
 * 1. Instalar Ollama: https://ollama.com/
 * 2. Descargar el modelo: `ollama pull gemma3:12b` (o el que prefieras)
 * 3. Configurar en .env: AI_PROVIDER=ollama
 *
 * Modelos recomendados para desarrollo:
 * - gemma3:4b   (~3GB RAM) — rápido, bueno para pruebas básicas
 * - gemma3:12b  (~8GB RAM) — equilibrio calidad/velocidad
 * - llama3.2:3b (~2GB RAM) — el más liviano para máquinas con poca RAM
 */
class OllamaProvider {
    constructor(config) {
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'gemma3:4b';
        this.providerName = 'Ollama (Local Dev)';
        this.ready = true;
        console.log(`✅ [Ollama] Initialized with model: ${this.model} at ${this.baseUrl}`);
    }

    async generateJSON(promptText) {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: `Eres un asistente experto. Responde SIEMPRE con JSON puro, sin markdown, sin explicaciones adicionales.\n\n${promptText}`,
                    stream: false,
                    format: 'json'
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                if (response.status === 404) {
                    console.error(`[Ollama] Modelo '${this.model}' no encontrado. Ejecuta: ollama pull ${this.model}`);
                }
                throw new Error(`Ollama error ${response.status}: ${errBody}`);
            }

            const data = await response.json();
            const text = data.response || '';

            // Ollama puede retornar JSON con o sin wrapper de markdown
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.error('[Ollama] Servidor no disponible. ¿Está corriendo Ollama? Ejecuta: ollama serve');
                const connError = new Error('Ollama no disponible en localhost:11434.');
                connError.code = 'AI_QUOTA_EXCEEDED'; // Tratado como falla para activar fallback
                throw connError;
            }
            console.error('[Ollama] Error:', error.message);
            return null;
        }
    }
}

module.exports = OllamaProvider;
