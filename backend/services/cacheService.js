/**
 * backend/services/cacheService.js
 *
 * Servicio de cache en memoria para optimización de performance SSR.
 * Implementa cache multi-nivel con TTL y invalidación inteligente.
 */

class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0
        };
    }

    /**
     * Obtiene un valor del cache.
     * @param {string} key - Clave del cache
     * @returns {any|null} Valor cacheado o null si no existe o expiró
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Verificar si expiró
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.evictions++;
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Guarda un valor en el cache.
     * @param {string} key - Clave del cache
     * @param {any} value - Valor a cachear
     * @param {number} ttlMs - Tiempo de vida en milisegundos (opcional)
     */
    set(key, value, ttlMs = null) {
        const entry = {
            value,
            createdAt: Date.now(),
            expiresAt: ttlMs ? Date.now() + ttlMs : null,
            accessCount: 0
        };

        this.cache.set(key, entry);
        this.stats.size = this.cache.size;

        // Limpieza automática si el cache crece demasiado
        if (this.cache.size > 1000) {
            this._cleanup();
        }
    }

    /**
     * Elimina una entrada del cache.
     * @param {string} key - Clave a eliminar
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.size = this.cache.size;
        }
        return deleted;
    }

    /**
     * Elimina todas las entradas que coincidan con un patrón.
     * @param {string} pattern - Patrón de claves (ej: 'empresa:*')
     */
    deletePattern(pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        let deletedCount = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }

        this.stats.size = this.cache.size;
        this.stats.evictions += deletedCount;
        return deletedCount;
    }

    /**
     * Limpia el cache eliminando entradas expiradas.
     */
    cleanup() {
        this._cleanup();
    }

    /**
     * Obtiene estadísticas del cache.
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            : 0;

        return {
            ...this.stats,
            hitRate: hitRate.toFixed(2) + '%',
            entries: this.cache.size,
            memoryUsage: this._estimateMemoryUsage()
        };
    }

    /**
     * Limpieza interna del cache.
     * @private
     */
    _cleanup() {
        const now = Date.now();
        let evicted = 0;

        for (const [key, entry] of this.cache.entries()) {
            // Eliminar entradas expiradas
            if (entry.expiresAt && now > entry.expiresAt) {
                this.cache.delete(key);
                evicted++;
            }
        }

        this.stats.evictions += evicted;
        this.stats.size = this.cache.size;
    }

    /**
     * Estimación del uso de memoria.
     * @private
     */
    _estimateMemoryUsage() {
        // Estimación aproximada: 1KB por entrada + tamaño de valores
        let estimatedBytes = this.cache.size * 1024;

        for (const entry of this.cache.values()) {
            try {
                const jsonStr = JSON.stringify(entry.value);
                estimatedBytes += jsonStr.length * 2; // UTF-16
            } catch {
                estimatedBytes += 1024; // Fallback
            }
        }

        const kb = estimatedBytes / 1024;
        const mb = kb / 1024;

        return mb > 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
    }
}

/**
 * Servicio de cache especializado para contenido SSR.
 */
class SSRCacheService {
    constructor() {
        this.cache = new MemoryCache();
        this.defaultTTLs = {
            empresaContext: 5 * 60 * 1000,      // 5 minutos
            brandIdentity: 5 * 60 * 1000,       // 5 minutos
            customCSS: 5 * 60 * 1000,           // 5 minutos
            corporateContent: 24 * 60 * 60 * 1000, // 24 horas
            propertyData: 10 * 60 * 1000,       // 10 minutos
            availability: 1 * 60 * 1000,        // 1 minuto
            pricing: 1 * 60 * 1000,             // 1 minuto
            ssrOptimized: 5 * 60 * 1000         // 5 minutos - datos optimizados para SSR
        };
    }

    /**
     * Obtiene contexto de empresa del cache.
     * @param {string} empresaId - ID de la empresa
     */
    getEmpresaContext(empresaId) {
        return this.cache.get(`empresa:context:${empresaId}`);
    }

    /**
     * Guarda contexto de empresa en el cache.
     * @param {string} empresaId - ID de la empresa
     * @param {Object} context - Contexto de empresa
     */
    setEmpresaContext(empresaId, context) {
        this.cache.set(
            `empresa:context:${empresaId}`,
            context,
            this.defaultTTLs.empresaContext
        );
    }

    /**
     * Obtiene identidad visual del cache.
     * @param {string} empresaId - ID de la empresa
     */
    getBrandIdentity(empresaId) {
        return this.cache.get(`empresa:brand:${empresaId}`);
    }

    /**
     * Guarda identidad visual en el cache.
     * @param {string} empresaId - ID de la empresa
     * @param {Object} brandIdentity - Identidad visual
     */
    setBrandIdentity(empresaId, brandIdentity) {
        this.cache.set(
            `empresa:brand:${empresaId}`,
            brandIdentity,
            this.defaultTTLs.brandIdentity
        );
    }

    /**
     * Obtiene CSS personalizado del cache.
     * @param {string} empresaId - ID de la empresa
     */
    getCustomCSS(empresaId) {
        return this.cache.get(`empresa:css:${empresaId}`);
    }

    /**
     * Guarda CSS personalizado en el cache.
     * @param {string} empresaId - ID de la empresa
     * @param {string} css - CSS personalizado
     */
    setCustomCSS(empresaId, css) {
        this.cache.set(
            `empresa:css:${empresaId}`,
            css,
            this.defaultTTLs.customCSS
        );
    }

    /**
     * Obtiene contenido corporativo del cache.
     * @param {string} empresaId - ID de la empresa
     */
    getCorporateContent(empresaId) {
        return this.cache.get(`empresa:content:${empresaId}`);
    }

    /**
     * Guarda contenido corporativo en el cache.
     * @param {string} empresaId - ID de la empresa
     * @param {Object} content - Contenido corporativo
     */
    setCorporateContent(empresaId, content) {
        this.cache.set(
            `empresa:content:${empresaId}`,
            content,
            this.defaultTTLs.corporateContent
        );
    }

    /**
     * Invalida todo el cache de una empresa.
     * @param {string} empresaId - ID de la empresa
     */
    invalidateEmpresa(empresaId) {
        const patterns = [
            `empresa:context:${empresaId}`,
            `empresa:brand:${empresaId}`,
            `empresa:css:${empresaId}`,
            `empresa:content:${empresaId}`,
            `ssr:${empresaId}:`,
            `property:*:${empresaId}:*`
        ];

        let totalDeleted = 0;
        patterns.forEach(pattern => {
            totalDeleted += this.cache.deletePattern(pattern);
        });

        return totalDeleted;
    }

    /**
     * Invalida cache específico de contenido corporativo.
     * @param {string} empresaId - ID de la empresa
     */
    invalidateCorporateContent(empresaId) {
        return this.cache.delete(`empresa:content:${empresaId}`);
    }

    /**
     * Invalida cache de identidad visual.
     * @param {string} empresaId - ID de la empresa
     */
    invalidateBrandIdentity(empresaId) {
        return this.cache.delete(`empresa:brand:${empresaId}`);
    }

    /**
     * Limpia todo el cache.
     */
    clear() {
        // El Map se recrea para liberar memoria
        this.cache = new MemoryCache();
    }

    /**
     * Función helper para cache con fallback.
     * @param {string} key - Clave del cache
     * @param {Function} fetchFn - Función para obtener datos si no están en cache
     * @param {number} ttlMs - TTL en milisegundos (opcional, usa default si no se especifica)
     * @returns {Promise<any>} Datos cacheados o recién obtenidos
     */
    async withCache(key, fetchFn, ttlMs = null) {
        // Intentar obtener del cache
        const cached = this.cache.get(key);
        if (cached !== null) {
            return cached;
        }

        // Obtener datos frescos
        const freshData = await fetchFn();

        // Guardar en cache
        this.cache.set(key, freshData, ttlMs);

        return freshData;
    }

    /**
     * Función helper específica para contenido corporativo con IA.
     * @param {string} empresaId - ID de la empresa
     * @param {Function} generateFn - Función para generar contenido con IA
     * @returns {Promise<Object>} Contenido corporativo
     */
    async getOrGenerateCorporateContent(empresaId, generateFn) {
        const cacheKey = `empresa:content:${empresaId}`;

        return this.withCache(
            cacheKey,
            async () => {
                console.log(`[Cache] Generando contenido corporativo para empresa ${empresaId}`);
                try {
                    return await generateFn();
                } catch (error) {
                    console.error(`[Cache] Error generando contenido corporativo: ${error.message}`);
                    throw error;
                }
            },
            this.defaultTTLs.corporateContent
        );
    }

    /**
     * Invalida todas las entradas de cache relacionadas con una empresa.
     * Se llama cuando los datos de la empresa cambian.
     * @param {string} empresaId - ID de la empresa
     */
    invalidateEmpresaCache(empresaId) {
        const patterns = [
            `empresa:context:${empresaId}`,
            `empresa:brand:${empresaId}`,
            `empresa:css:${empresaId}`,
            `empresa:content:${empresaId}`,
            `empresa:ssr_optimized:${empresaId}`,
            `ssr:${empresaId}:`
        ];

        let invalidatedCount = 0;
        for (const key of this.cache.cache.keys()) {
            for (const pattern of patterns) {
                if (key.startsWith(pattern)) {
                    this.cache.cache.delete(key);
                    invalidatedCount++;
                    break;
                }
            }
        }

        console.log(`[Cache] Invalidados ${invalidatedCount} entradas para empresa ${empresaId}`);
        return invalidatedCount;
    }

    /**
     * Invalida cache específico por clave o patrón.
     * @param {string} keyOrPattern - Clave exacta o patrón de clave
     * @returns {number} Número de entradas invalidadas
     */
    invalidateByKey(keyOrPattern) {
        let invalidatedCount = 0;

        if (this.cache.cache.has(keyOrPattern)) {
            this.cache.cache.delete(keyOrPattern);
            invalidatedCount = 1;
        } else {
            // Buscar por patrón
            for (const key of this.cache.cache.keys()) {
                if (key.includes(keyOrPattern)) {
                    this.cache.cache.delete(key);
                    invalidatedCount++;
                }
            }
        }

        if (invalidatedCount > 0) {
            console.log(`[Cache] Invalidadas ${invalidatedCount} entradas para patrón "${keyOrPattern}"`);
        }

        return invalidatedCount;
    }

    /**
     * Obtiene estadísticas del cache SSR.
     * @returns {Object} Estadísticas del cache
     */
    getStats() {
        return this.cache.getStats();
    }

    /**
     * Limpia todo el cache.
     * @returns {number} Número de entradas eliminadas
     */
    clearAll() {
        const stats = this.cache.getStats();
        const size = stats.entries || 0;
        this.cache = new MemoryCache();
        console.log(`[Cache] Cache limpiado completamente (${size} entradas eliminadas)`);
        return size;
    }
}

// Singleton global del servicio de cache
const ssrCache = new SSRCacheService();

module.exports = {
    MemoryCache,
    SSRCacheService,
    ssrCache
};