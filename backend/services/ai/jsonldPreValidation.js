/**
 * backend/services/ai/jsonldPreValidation.js
 *
 * Validación pre-generación de JSON-LD
 * Verifica que los datos necesarios estén completos antes de generar JSON-LD
 */

const { getMainSchemaType } = require('./schemaMappings');
const { contarDistribucion } = require('../propiedadLogicService');

/**
 * Valida que los datos necesarios para generar JSON-LD estén completos
 */
function validatePreGenerationData(buildContext) {
    const { empresa, producto, narrativa } = buildContext;
    const errors = [];
    const warnings = [];

    // 1. Validar empresa
    if (!empresa) {
        errors.push('Falta información de la empresa');
    } else {
        if (!empresa.nombre) errors.push('Falta nombre de la empresa');
        if (!empresa.tipoNegocio) warnings.push('tipoNegocio no definido, se usará "complejo" por defecto');

        // Validar ubicación
        const ubi = empresa.ubicacion || {};
        if (!ubi.ciudad) warnings.push('Falta ciudad en la ubicación de la empresa');
        if (!ubi.region) warnings.push('Falta región en la ubicación de la empresa');
        if (!ubi.pais) warnings.push('Falta país en la ubicación de la empresa');
    }

    // 2. Validar producto (alojamiento)
    if (!producto) {
        errors.push('Falta información del producto/alojamiento');
    } else {
        if (!producto.nombre) errors.push('Falta nombre del alojamiento');
        if (!producto.capacidad || producto.capacidad <= 0) errors.push('Capacidad no definida o inválida');
        if (!producto.numPiezas || producto.numPiezas <= 0) warnings.push('Número de dormitorios no definido');
        if (!producto.numBanos || producto.numBanos <= 0) warnings.push('Número de baños no definido');

        // Validar espacios
        if (!producto.espacios || producto.espacios.length === 0) {
            warnings.push('El alojamiento no tiene espacios definidos');
        } else {
            const tieneDormitorios = producto.espacios.some(e =>
                e.categoria?.toLowerCase().includes('dormitorio') ||
                e.nombre?.toLowerCase().includes('dormitorio')
            );
            if (!tieneDormitorios) warnings.push('No se detectaron dormitorios en los espacios');

            // Validar consistencia de baños entre producto.numBanos y cálculo real
            if (producto.numBanos !== undefined && producto.numBanos > 0) {
                // Extraer componentes de los espacios para calcular baños reales
                const componentes = [];
                producto.espacios.forEach(espacio => {
                    if (espacio.activos && Array.isArray(espacio.activos)) {
                        espacio.activos.forEach(activo => {
                            if (activo.nombre) {
                                componentes.push({
                                    nombre: activo.nombre,
                                    tipo: activo.categoria || ''
                                });
                            }
                        });
                    }
                });

                if (componentes.length > 0) {
                    const { numBanos: calculatedBanos } = contarDistribucion(componentes);
                    if (producto.numBanos !== calculatedBanos) {
                        warnings.push(`Inconsistencia en número de baños: definido=${producto.numBanos}, calculado=${calculatedBanos}. Verificar componentes del alojamiento.`);
                    }
                }
            }
        }
    }

    // 3. Validar narrativa (contenido generado)
    if (!narrativa || !narrativa.descripcionComercial) {
        warnings.push('Falta descripción comercial generada. Se usará descripción básica si existe.');
    }

    // 4. Validar fotos en galería (requerir mínimo 3 para buen SEO)
    // Nota: Esta validación se hace en tiempo de ejecución con la query real

    return {
        canGenerate: errors.length === 0,
        errors,
        warnings,
        recommendedAction: errors.length > 0 ? 'Completar datos faltantes' :
                          warnings.length > 0 ? 'Revisar advertencias' : 'Listo para generar'
    };
}

/**
 * Genera recomendaciones para mejorar el JSON-LD basado en los datos
 */
function getGenerationRecommendations(buildContext) {
    const { empresa, producto } = buildContext;
    const recommendations = [];

    // 1. Recomendaciones según tipo de negocio
    const tipoNegocio = empresa?.tipoNegocio || 'complejo';

    if (tipoNegocio === 'hotel') {
        recommendations.push({
            priority: 'high',
            message: 'Para hoteles, considera agregar starRating y amenities específicas de hotel',
            action: 'Agregar campo starRating y amenities como desayuno incluido, servicio de habitaciones, etc.'
        });
    } else if (tipoNegocio === 'cartera') {
        recommendations.push({
            priority: 'medium',
            message: 'Para cartera de departamentos, incluye priceRange y políticas específicas',
            action: 'Definir rango de precios y políticas de cancelación'
        });
    }

    // 2. Recomendaciones de SEO
    if (producto) {
        if (!producto.palabrasClave || producto.palabrasClave.length === 0) {
            recommendations.push({
                priority: 'medium',
                message: 'Faltan palabras clave para SEO',
                action: 'Agregar palabras clave relevantes para el alojamiento'
            });
        }

        if (producto.capacidad > 10) {
            recommendations.push({
                priority: 'low',
                message: 'Alojamiento de gran capacidad, destacar en meta description',
                action: 'Incluir "ideal para grupos grandes" en la descripción SEO'
            });
        }
    }

    // 3. Recomendaciones de imágenes
    recommendations.push({
        priority: 'high',
        message: 'Se requieren mínimo 3 fotos de calidad para buen SEO',
        action: 'Subir fotos de portada, interiores y exteriores'
    });

    return recommendations;
}

/**
 * Prepara los datos para el prompt de JSON-LD
 */
function prepareJsonLdData(buildContext) {
    const { empresa, producto, narrativa } = buildContext;
    const tipoNegocio = empresa?.tipoNegocio || 'complejo';
    const schemaInfo = getMainSchemaType(tipoNegocio);

    // Datos básicos requeridos
    const baseData = {
        empresa: {
            nombre: empresa?.nombre || 'Empresa no definida',
            tipoNegocio: tipoNegocio,
            slogan: empresa?.slogan || '',
            contactoTelefono: empresa?.contactoTelefono || '',
            ubicacion: empresa?.ubicacion || {}
        },
        producto: {
            nombre: producto?.nombre || 'Alojamiento no definido',
            tipo: producto?.tipo || 'alojamiento',
            capacidad: producto?.capacidad || 2,
            numPiezas: producto?.numPiezas || 1,
            numBanos: producto?.numBanos || 1,
            espacios: producto?.espacios || []
        },
        narrativa: {
            descripcionComercial: narrativa?.descripcionComercial || producto?.descripcionLibre || '',
            uniqueSellingPoints: narrativa?.uniqueSellingPoints || []
        },
        schemaInfo: schemaInfo
    };

    return baseData;
}

/**
 * Valida el JSON-LD generado por la IA
 */
function validateGeneratedJsonLd(generatedJsonLd, buildContext) {
    const { validateJsonLd } = require('./schemaMappings');
    const tipoNegocio = buildContext.empresa?.tipoNegocio || 'complejo';

    const validation = validateJsonLd(generatedJsonLd, tipoNegocio);

    // Validaciones adicionales específicas
    const additionalChecks = [];

    // Verificar que las imágenes sean URLs válidas
    if (generatedJsonLd.image && Array.isArray(generatedJsonLd.image)) {
        const invalidImages = generatedJsonLd.image.filter(img =>
            !img || typeof img !== 'string' || !img.startsWith('http')
        );
        if (invalidImages.length > 0) {
            additionalChecks.push(`Hay ${invalidImages.length} URLs de imagen inválidas`);
        }
    }

    // Verificar que containsPlace tenga tipos válidos
    if (generatedJsonLd.containsPlace && Array.isArray(generatedJsonLd.containsPlace)) {
        const invalidTypes = generatedJsonLd.containsPlace.filter(place =>
            place['@type'] === 'Room' || place['@type'] === 'Thing'
        );
        if (invalidTypes.length > 0) {
            additionalChecks.push(`${invalidTypes.length} espacios tienen tipos genéricos (Room/Thing) en lugar de tipos específicos`);
        }
    }

    return {
        ...validation,
        additionalChecks,
        overallValid: validation.isValid && additionalChecks.length === 0
    };
}

module.exports = {
    validatePreGenerationData,
    getGenerationRecommendations,
    prepareJsonLdData,
    validateGeneratedJsonLd
};