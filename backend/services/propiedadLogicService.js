// backend/services/propiedadLogicService.js

// Simulación del Catálogo Maestro (Mock definitions)
// En el futuro, esto debería venir de una base de datos o servicio de configuración.
const MASTER_DEFINITIONS = {
    // CAMAS Y DORMITORIO
    "Cama King": { capacity: 2, schema_type: "KingBed", verification_required: true, required_shots: ["Foto frontal de la cama", "Detalle de almohadas/cojines"] },
    "Cama Queen": { capacity: 2, schema_type: "QueenBed", verification_required: true, required_shots: ["Foto frontal de la cama"] },
    "Cama 2 Plazas": { capacity: 2, schema_type: "DoubleBed", verification_required: true, required_shots: ["Foto frontal de la cama"] },
    "Cama 1.5 Plazas": { capacity: 1, schema_type: "SingleBed", verification_required: true, required_shots: ["Foto de la cama"] },
    "Cama Plaza y Media": { capacity: 1, schema_type: "SingleBed", verification_required: true, required_shots: ["Foto de la cama"] }, // Alias común
    "Cama 1 Plaza": { capacity: 1, schema_type: "SingleBed", verification_required: true, required_shots: ["Foto de la cama"] },
    "Litera": { capacity: 2, schema_type: "BunkBed", verification_required: true, required_shots: ["Foto completa de la litera"] },
    "Sofá Cama": { capacity: 1, schema_type: "SofaBed", verification_required: false, required_shots: ["Foto del sofá (cerrado)", "Foto del sofá cama (abierto)"] },
    "Cama Nido": { capacity: 1, schema_type: "SingleBed", verification_required: true, required_shots: ["Foto de la cama nido"] },
    "Catre": { capacity: 1, schema_type: "SingleBed", verification_required: true, required_shots: ["Foto del catre"] },
    "Futón": { capacity: 1, schema_type: "SofaBed", verification_required: false, required_shots: ["Foto del futón"] },
    "Velador": { capacity: 0, schema_type: "Nightstand", verification_required: false, required_shots: ["Detalle del velador"] },
    "Closet": { capacity: 0, schema_type: "Closet", verification_required: false, required_shots: ["Foto del closet abierto"] },
    "Ropa de Cama": { capacity: 0, schema_type: "Bedding", verification_required: false },
    "Almohadas": { capacity: 0, schema_type: "Pillows", verification_required: false },

    // BAÑO
    "Ducha": { capacity: 0, schema_type: "Shower", verification_required: true, required_shots: ["Foto completa de la ducha", "Detalle de la grifería"] },
    "Tina": { capacity: 0, schema_type: "Bathtub", verification_required: true, required_shots: ["Foto de la tina"] },
    "Inodoro": { capacity: 0, schema_type: "Toilet", verification_required: true, required_shots: ["Foto general del inodoro"] },
    "W.C.": { capacity: 0, schema_type: "Toilet", verification_required: true, required_shots: ["Foto general del W.C."] }, // Alias
    "Lavamanos": { capacity: 0, schema_type: "Sink", verification_required: true, required_shots: ["Foto del lavamanos", "Detalle de grifería"] },
    "Vanitorio": { capacity: 0, schema_type: "Sink", verification_required: true, required_shots: ["Foto del vanitorio", "Detalle de grifería"] }, // Alias
    "Secador de Pelo": { capacity: 0, schema_type: "HairDryer", verification_required: false },
    "Toallas": { capacity: 0, schema_type: "Towels", verification_required: false },

    // COCINA
    "Refrigerador": { capacity: 0, schema_type: "Refrigerator", verification_required: true, required_shots: ["Foto del refrigerador (cerrado)", "Foto del interior (opcional)"] },
    "Cocina a Gas": { capacity: 0, schema_type: "Stove", verification_required: true, required_shots: ["Foto de la cocina/encimera"] },
    "Cocina Eléctrica": { capacity: 0, schema_type: "Stove", verification_required: true, required_shots: ["Foto de la cocina/encimera"] },
    "Encimera": { capacity: 0, schema_type: "Stove", verification_required: true, required_shots: ["Foto de la encimera"] }, // Alias
    "Horno": { capacity: 0, schema_type: "Oven", verification_required: true, required_shots: ["Foto del horno"] },
    "Microondas": { capacity: 0, schema_type: "Microwave", verification_required: false, required_shots: ["Foto del microondas"] },
    "Hervidor": { capacity: 0, schema_type: "Kettle", verification_required: false },
    "Tostadora": { capacity: 0, schema_type: "Toaster", verification_required: false },
    "Vajilla": { capacity: 0, schema_type: "Dishes", verification_required: false, required_shots: ["Foto de la vajilla/cubiertos"] },
    "Lavaplatos": { capacity: 0, schema_type: "Sink", verification_required: true, required_shots: ["Foto del lavaplatos"] },

    // SALA / COMEDOR
    "Sillón": { capacity: 0, schema_type: "Sofa", verification_required: false, required_shots: ["Foto del sillón"] },
    "Sofá": { capacity: 0, schema_type: "Sofa", verification_required: false, required_shots: ["Foto del sofá"] },
    "Mesa de Centro": { capacity: 0, schema_type: "Table", verification_required: false, required_shots: ["Foto de la mesa de centro"] },
    "Comedor": { capacity: 0, schema_type: "DiningTable", verification_required: false, required_shots: ["Foto del comedor completo"] },
    "Sillas de Comedor": { capacity: 0, schema_type: "Chair", verification_required: false },
    "Estufa a Leña": { capacity: 0, schema_type: "Fireplace", verification_required: false, required_shots: ["Foto de la estufa/chimenea"] },
    "Chimenea": { capacity: 0, schema_type: "Fireplace", verification_required: false, required_shots: ["Foto de la chimenea"] },

    // EXTERIOR Y OTROS
    "Parrilla a Gas": { capacity: 0, schema_type: "BarbecueGrill", verification_required: false, required_shots: ["Foto de la parrilla"] },
    "Parrilla a Carbón": { capacity: 0, schema_type: "BarbecueGrill", verification_required: false, required_shots: ["Foto de la parrilla"] },
    "Quincho": { capacity: 0, schema_type: "BarbecueGrill", verification_required: false, required_shots: ["Foto general del quincho"] },
    "Tinaja Caliente": { capacity: 0, schema_type: "HotTub", verification_required: true, required_shots: ["Foto de la tinaja", "Vista desde la tinaja"] },
    "Piscina": { capacity: 0, schema_type: "SwimmingPool", verification_required: true, required_shots: ["Foto general de la piscina", "Foto del área de descanso"] },
    "Wifi": { capacity: 0, schema_type: "WiFi", verification_required: false },
    "Estacionamiento": { capacity: 0, schema_type: "Parking", verification_required: false, required_shots: ["Foto del estacionamiento"] },
    "Terraza": { capacity: 0, schema_type: "Terrace", verification_required: false, required_shots: ["Vista general de la terraza"] },
    "Mesa de Terraza": { capacity: 0, schema_type: "OutdoorTable", verification_required: false, required_shots: ["Foto de la mesa de terraza"] },
    "Sillas de Terraza": { capacity: 0, schema_type: "OutdoorChairs", verification_required: false },
    "Aire Acondicionado": { capacity: 0, schema_type: "AirConditioning", verification_required: false, required_shots: ["Foto del equipo de A/C"] },
    "Calefacción": { capacity: 0, schema_type: "Heating", verification_required: false },
    "TV": { capacity: 0, schema_type: "TV", verification_required: false, required_shots: ["Foto de la TV"] }
};

/**
 * Calcula la capacidad total de una propiedad basada en sus componentes y elementos.
 * @param {Array} componentes - Lista de componentes de la propiedad.
 * @returns {number} Capacidad total calculada.
 */
function calcularCapacidad(componentes) {
    if (!Array.isArray(componentes)) return 0;

    let capacidadTotal = 0;

    componentes.forEach(comp => {
        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                // Si el elemento es contable (ej: cama), sumamos su valor * cantidad
                if (el.countable) {
                    const cantidad = el.cantidad || 1;
                    const valorUnitario = el.count_value || 0;
                    capacidadTotal += (cantidad * valorUnitario);
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
            // Si es un "Baño en Suite", ya lo detectamos como baño aquí.
            // Si el componente se llama "Baño en Suite Dormitorio", es un baño.
            numBanos++;
        } else if (isDormitorio) {
            // Solo contamos como pieza si NO es un baño
            numPiezas++;
            // Lógica En Suite: Si es dormitorio y dice "SUITE", asumimos +1 baño
            if (nombre.includes('SUITE') || tipo.includes('SUITE')) {
                numBanos++;
            }
        }
    });

    return { numPiezas, numBanos };
}

/**
 * Genera un inventario determinista y auditable para agentes de IA.
 * @param {Array} componentes 
 * @returns {Array} Lista de items verificados { description, quantity, location, verified: true }
 */
function getVerifiedInventory(componentes) {
    if (!Array.isArray(componentes)) return [];

    const inventory = [];

    componentes.forEach(comp => {
        const locationName = comp.nombre || comp.tipo || 'General';

        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                // Solo elementos contables o relevantes
                if (el.countable && el.cantidad > 0) {
                    inventory.push({
                        description: `${el.nombre} (${el.subTipo || 'Estándar'})`,
                        quantity: Number(el.cantidad), // Asegurar número
                        location: locationName,
                        capacity_contribution: (el.cantidad * (el.count_value || 0)),
                        verified: true // Señal para la IA de que esto es data dura, no alucinación
                    });
                } else if (!el.countable) {
                    inventory.push({
                        description: el.nombre,
                        quantity: 1,
                        location: locationName,
                        verified: true
                    });
                }
            });
        }
    });

    return inventory;
}

// [REFACTOR] SSR con Reglas Extensibles
const COMPONENT_SHOT_RULES = {
    'DORMITORIO': { shot: 'Vista General', priority: 'Alta', description: 'Vista amplia del dormitorio desde la entrada.' },
    'COCINA': { shot: 'Vista General', priority: 'Alta', description: 'Vista general de la cocina y sus electrodomésticos.' },
    'BANO': { shot: 'Vista General', priority: 'Media', description: 'Vista del baño mostrando ducha/tina y lavamanos.' },
    'TERRAZA': { shot: 'Vista General', priority: 'Media', description: 'Vista de la terraza y el paisaje.' },
    'LIVING': { shot: 'Vista General', priority: 'Alta', description: 'Vista del área de estar principal.' }
};

/**
 * Genera un plan de fotos (SSR) basado en la estructura de la propiedad.
 * @param {Array} componentes 
 * @returns {Object} Mapa de planes por componente { componentId: [ { shot, priority, description } ] }
 */
function generarPlanFotos(componentes, tipos = []) {
    if (!Array.isArray(componentes)) return {};

    // 1. Hidratar el inventario para tener acceso a los metadatos enriquecidos (incluyendo required_shots)
    const { inventory: inventarioHidratado } = hydrateInventory(componentes);

    const plan = {};

    inventarioHidratado.forEach(comp => {
        const requisitos = [];
        const tipoNormalizado = (comp.tipo || '').toUpperCase().trim();

        // [NEW] Buscar configuración del Tipo de Componente (Usuario)
        const tipoConfig = tipos.find(t =>
            (t.nombreNormalizado && normalizeKey(t.nombreNormalizado) === normalizeKey(comp.tipo)) ||
            (t.nombreUsuario && normalizeKey(t.nombreUsuario) === normalizeKey(comp.tipo)) ||
            (t.nombreNormalizado && normalizeKey(t.nombreNormalizado) === normalizeKey(comp.nombre))
        );

        // Recolectar TODOS los requisitos específicos de los elementos primero
        let elementRequirements = [];
        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                if (Array.isArray(el.required_shots) && el.required_shots.length > 0) {
                    el.required_shots.forEach(reqShot => {
                        elementRequirements.push(reqShot);
                    });
                }
                // Mantener soporte para photo_requirements manuales
                if (Array.isArray(el.photo_requirements)) {
                    el.photo_requirements.forEach(req => elementRequirements.push(req));
                }
            });
        }

        // [LOGIC] Si hay configuración de usuario con shotList, usamos esa estructura
        if (tipoConfig && Array.isArray(tipoConfig.shotList) && tipoConfig.shotList.length > 0) {

            // Crear slots basados en la configuración del usuario
            tipoConfig.shotList.forEach((shotTitle, index) => {
                if (!shotTitle) return; // Skip invalid shots

                let description = shotTitle;

                // Distribuir los requisitos de elementos en los slots disponibles
                if (index === 0 && elementRequirements.length > 0) {
                    const uniqueReqs = [...new Set(elementRequirements)]; // Eliminar duplicados
                    description += `. Asegúrate de incluir: ${uniqueReqs.join(', ')}.`;
                }

                requisitos.push({
                    shot: shotTitle,
                    priority: 'Alta',
                    description: description || 'Vista General',
                    ai_generated: true
                });
            });

        } else {
            // [FALLBACK] Comportamiento anterior: 1 slot por requisito + reglas generales

            // 1. Reglas por Tipo de Componente (Strategy Pattern) - Nivel Macro
            if (COMPONENT_SHOT_RULES[tipoNormalizado]) {
                requisitos.push(COMPONENT_SHOT_RULES[tipoNormalizado]);
            }

            // 2. Requisitos por Elementos (Nivel Micro)
            elementRequirements.forEach(reqShot => {
                requisitos.push({
                    shot: `Detalle Requerido`,
                    priority: 'Alta',
                    description: reqShot,
                    ai_generated: true
                });
            });
        }

        // [SAFETY] Si no hay requisitos generados, agregar uno por defecto para evitar "Paso 1 de 0"
        if (requisitos.length === 0) {
            requisitos.push({
                shot: 'Vista General',
                priority: 'Alta',
                description: `Vista general de ${comp.nombre || 'el espacio'}.`,
                ai_generated: true
            });
        }

        plan[comp.id] = requisitos;
    });

    return plan;
}

/**
 * Normaliza un string para comparación (elimina acentos, minúsculas).
 */
function normalizeKey(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Hidrata el inventario ligero con metadatos del catálogo maestro.
 * @param {Array} componentes - JSON ligero de entrada.
 * @returns {Object} { inventory: Array, ai_readiness_score: string }
 */
function hydrateInventory(componentes) {
    if (!Array.isArray(componentes)) return { inventory: [], ai_readiness_score: "0%" };

    let totalItems = 0;
    let knownItems = 0;

    // Pre-calcular llaves normalizadas del maestro para búsqueda rápida
    const masterKeys = Object.keys(MASTER_DEFINITIONS);
    const normalizedMaster = masterKeys.map(k => ({
        original: k,
        normalized: normalizeKey(k)
    }));

    const inventory = componentes.map(comp => {
        const enrichedElements = (comp.elementos || []).map(el => {
            totalItems++;

            const elNameNorm = normalizeKey(el.nombre || '');
            let definition = null;

            // 1. Búsqueda Exacta (Normalizada)
            const exactMatch = normalizedMaster.find(m => m.normalized === elNameNorm);

            // 2. Búsqueda Parcial (Fuzzy - Contiene)
            // Ej: "Cama King Size" contiene "cama king" (del maestro)
            const fuzzyMatch = !exactMatch ? normalizedMaster.find(m => elNameNorm.includes(m.normalized)) : null;

            // 3. Búsqueda Inversa (Fuzzy - Contenido en)
            // Ej: "Ducha" (del maestro) está contenido en "Cabina de Ducha"
            const reverseMatch = !exactMatch && !fuzzyMatch ? normalizedMaster.find(m => m.normalized.includes(elNameNorm) || elNameNorm.includes(m.normalized)) : null;

            const match = exactMatch || fuzzyMatch || reverseMatch;

            if (match) {
                definition = MASTER_DEFINITIONS[match.original];
                knownItems++;
            } else {
                // Fallback seguro
                definition = {
                    capacity: 0,
                    schema_type: "Unknown",
                    verification_required: false
                };
            }

            return {
                ...el,
                ...definition,
                // Calcular capacidad total de este grupo de elementos
                capacidad_total: (el.cantidad || 1) * definition.capacity,
                // Estado de verificación para SSR/SEO
                ssr_status: definition.verification_required ? "verified" : "optional",
                // Debug info
                _match_method: exactMatch ? 'exact' : (fuzzyMatch ? 'fuzzy' : (reverseMatch ? 'reverse' : 'none'))
            };
        });

        return {
            ...comp,
            elementos: enrichedElements
        };
    });

    // Calcular score de preparación para IA
    const score = totalItems > 0 ? Math.round((knownItems / totalItems) * 100) : 100;

    return {
        inventory,
        ai_readiness_score: `${score}%`
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
