// backend/services/propiedadLogicService.js


/**
 * Calcula la capacidad total de una propiedad basada en sus componentes y elementos.
 * Regla única: solo suman los elementos con capacity definido explícitamente como número > 0.
 * Elementos sin capacity definido o con capacity=0 contribuyen 0.
 * @param {Array} componentes - Lista de componentes de la propiedad.
 * @returns {number} Capacidad total calculada.
 */
function calcularCapacidad(componentes) {
    if (!Array.isArray(componentes)) return 0;

    let capacidadTotal = 0;

    componentes.forEach(comp => {
        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                const capacity = Number(el.capacity);
                if (!isNaN(capacity) && capacity > 0 && el.sumaCapacidad !== false) {
                    const quantity = Number(el.cantidad || 1);
                    capacidadTotal += quantity * capacity;
                }
            });
        }
    });

    return capacidadTotal;
}

/**
 * Cuenta el número de dormitorios y baños basados en los tipos de componentes.
 * @param {Array} componentes 
 * @returns {Object} { numPiezas, numBanos }
 */
function contarDistribucion(componentes) {
    if (!Array.isArray(componentes)) return { numPiezas: 0, numBanos: 0 };

    let numPiezas = 0;
    let numBanos = 0;

    componentes.forEach(comp => {
        // Normalizar a mayúsculas y eliminar acentos para comparación robusta
        const rawTipo = (comp.tipo || '').toUpperCase();
        const rawNombre = (comp.nombre || '').toUpperCase();

        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const tipo = normalize(rawTipo);
        const nombre = normalize(rawNombre);

        // Palabras clave para detectar tipos
        const isDormitorio = tipo.includes('DORMITORIO') || tipo.includes('HABITACION') || tipo.includes('PIEZA') || tipo.includes('BEDROOM') ||
            nombre.includes('DORMITORIO') || nombre.includes('HABITACION');

        const isBano = tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
            nombre.includes('BANO') || nombre.includes('TOILET');

        if (isBano) {
            numBanos++;
        } else if (isDormitorio) {
            numPiezas++;
            if (nombre.includes('SUITE') || tipo.includes('SUITE')) {
                numBanos++;
            }
        }
    });

    return { numPiezas, numBanos };
}

/**
 * Genera un inventario determinista.
 * @param {Array} componentes 
 * @returns {Array} Lista de items
 */
function getVerifiedInventory(componentes) {
    if (!Array.isArray(componentes)) return [];
    const inventory = [];

    componentes.forEach(comp => {
        const locationName = comp.nombre || comp.tipo || 'General';
        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                inventory.push({
                    description: el.nombre,
                    quantity: Number(el.cantidad || 1),
                    location: locationName,
                    verified: true
                });
            });
        }
    });
    return inventory;
}

/**
 * Genera un plan de fotos inteligente usando los metadatos de activos normalizados por IA.
 * Para cada espacio incluye: foto general + shots del tipo de espacio + activos con requires_photo=true.
 * @param {Array} componentes - Espacios del alojamiento con sus elementos
 * @param {Array} tipos - tiposComponente (espacios maestros con shotList)
 * @param {Array} tiposElemento - tiposElemento (activos con requires_photo, photo_guidelines, photo_quantity)
 * @returns {Object} Mapa { componentId: [ { shot, priority, description, guidelines, type } ] }
 */
function generarPlanFotos(componentes, _tipos = [], tiposElemento = []) {
    if (!Array.isArray(componentes)) return {};

    // Lookup rápido de activos por ID
    const activoMap = new Map(tiposElemento.map(t => [t.id, t]));

    const plan = {};

    componentes.forEach(comp => {
        const shots = [];

        // 1. Foto general del espacio (siempre requerida)
        shots.push({
            shot: `Vista general - ${comp.nombre}`,
            priority: 'Alta',
            description: `Vista general de ${comp.nombre}`,
            guidelines: `Foto panorámica desde la entrada del espacio. Mostrar la totalidad del área con buena iluminación natural. Ideal para portada del espacio en el sitio web.`,
            type: 'espacio_general',
            required: true
        });

        // 2. Activos con requires_photo = true (fuente de verdad: activos reales del espacio)
        // La shotList de tiposComponente se omite intencionalmente — es un template genérico
        // del tipo y puede referenciar activos que no existen en esta instancia específica.
        const elementos = comp.elementos || [];
        elementos.forEach(el => {
            const activo = activoMap.get(el.tipoId || el.id);
            if (!activo?.requires_photo) return;

            const cantidad = el.cantidad || 1;
            const label = cantidad > 1 ? `${activo.nombre} (×${cantidad})` : activo.nombre;
            const numFotos = activo.photo_quantity || 1;

            // Si requiere más de una foto, agregamos un slot por cada foto requerida
            for (let i = 0; i < numFotos; i++) {
                const shotLabel = numFotos > 1 ? `${label} - Foto ${i + 1}` : label;
                shots.push({
                    shot: shotLabel,
                    priority: 'Alta',
                    description: shotLabel,
                    guidelines: activo.photo_guidelines || `Foto clara de ${activo.nombre} mostrando estado y calidad. Buena iluminación.`,
                    type: 'activo',
                    activoId: activo.id,
                    required: true
                });
            }
        });

        plan[comp.id] = shots;
    });

    return plan;
}

/**
 * Hidrata el inventario (Standardization Only).
 * Ya no intenta adivinar capacidades.
 * @param {Array} componentes 
 * @returns {Object} { inventory: Array, ai_readiness_score: string }
 */
function hydrateInventory(componentes) {
    if (!Array.isArray(componentes)) return { inventory: [], ai_readiness_score: "100%" };

    const inventory = componentes.map(comp => {
        const enrichedElements = (comp.elementos || []).map(el => {
            // Lógica Simplificada: Lo que viene es lo que es.
            // Si capacity no está definido, mantenemos undefined (no lo forzamos a 0)
            const capacity = (typeof el.capacity !== 'undefined' && el.capacity !== null)
                ? Number(el.capacity)
                : undefined;

            return {
                ...el,
                capacity: capacity, // Mantenemos undefined si no estaba definido
                capacidad_total: capacity !== undefined ? ((el.cantidad || 1) * capacity) : 0,
                ssr_status: "verified",
                _match_method: 'database' // Provenance: Database
            };
        });

        return {
            ...comp,
            elementos: enrichedElements
        };
    });

    return {
        inventory,
        ai_readiness_score: "100%"
    };
}

/**
 * Calcula la capacidad total basada en el inventario hidratado.
 * @param {Object} inventarioHidratado - Salida de hydrateInventory.
 * @returns {number} Capacidad total.
 */
function calcularCapacidadTotal(inventarioHidratado) {
    if (!inventarioHidratado || !Array.isArray(inventarioHidratado.inventory)) return 0;

    let total = 0;
    inventarioHidratado.inventory.forEach(comp => {
        comp.elementos.forEach(el => {
            total += el.capacidad_total || 0;
        });
    });
    return total;
}

module.exports = {
    calcularCapacidad,
    contarDistribucion,
    generarPlanFotos,
    getVerifiedInventory,
    hydrateInventory,
    calcularCapacidadTotal
};
