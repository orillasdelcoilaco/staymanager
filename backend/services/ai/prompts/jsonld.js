/**
 * backend/services/ai/prompts/jsonld.js
 *
 * Prompt para generar JSON-LD schema.org/LodgingBusiness + meta SEO
 * desde el PropertyBuildContext completo.
 *
 * El output es un JSON estructurado que:
 *  1. Permite a Google SGE, ChatGPT browsing y Perplexity encontrar la propiedad
 *  2. Usa los schema_type reales de cada activo (ej: HotTub, BedDetails)
 *  3. Genera metaTitle y metaDescription optimizados para CTR
 */
const { withSsrCommerceObjective } = require('./ssrCommerceContext');

function buildJsonLdSeoPromptBody({
    empresa,
    producto,
    narrativa,
    tipoNegocio,
    schemaType,
    additionalType,
    schemaDescription,
    ubicacionLinea,
    ubi,
    tieneCoords,
    espaciosResumen,
    amenidades
}) {
    return `Eres un Experto en SEO Técnico y Datos Estructurados para hospitalidad y turismo.
Tu especialidad es generar markup schema.org que posiciona alojamientos en la primera página
de Google SGE, ChatGPT browsing y Perplexity.

Tienes el perfil completo de un alojamiento turístico. Genera exactamente:
1. El objeto JSON-LD schema.org completo para esta propiedad
2. El metaTitle SEO (55–70 caracteres preferido; máximo 72, siempre frase completa sin cortar a mitad de artículo o preposición — ciudad + diferenciador clave)
3. La metaDescription SEO (máx 155 caracteres, orientada a conversión, incluir CTA)
4. Un array "keywords" con 8 a 18 frases cortas (2-4 palabras) para meta keywords en HTML: ciudad, tipo de alojamiento, amenidades fuertes, público objetivo, sin duplicar el título literal

PERFIL DEL ALOJAMIENTO:
- Empresa: "${empresa.nombre}" (${empresa.tipo || 'alojamiento turístico'})
- Tipo de Negocio: ${tipoNegocio} (${schemaDescription})
- Ubicación: ${ubicacionLinea || 'no especificada'}
- Dirección completa: "${ubi.direccion || ubicacionLinea || ''}"
- Slogan: "${empresa.slogan || ''}"
- Alojamiento: "${producto.nombre}" (${producto.tipo || 'alojamiento'})
- Capacidad: ${producto.capacidad} personas
- Dormitorios: ${producto.numPiezas}, Baños: ${producto.numBanos}
- Descripción comercial: "${narrativa?.descripcionComercial || producto.descripcionLibre || ''}"
- Puntos únicos de venta: ${JSON.stringify(narrativa?.uniqueSellingPoints || [])}

ESPACIOS (para containsPlace):
${JSON.stringify(espaciosResumen, null, 2)}

AMENIDADES VERIFICADAS (usa estos datos exactos para amenityFeature):
${JSON.stringify(amenidades, null, 2)}

REGLAS JSON-LD OBLIGATORIAS SEGÚN TIPO DE NEGOCIO:
1. "@context": "https://schema.org"
2. "@type": ${Array.isArray(schemaType) ? JSON.stringify(schemaType) : `"${schemaType}"`} ${additionalType ? `\n   "additionalType": "${additionalType}"` : ''}
3. "name": nombre del alojamiento
4. "description": descripción comercial (si está disponible)
5. "address": objeto PostalAddress con:
   - "streetAddress": SOLO la dirección de calle/sector si está disponible ("${ubi.direccion || ''}"). Si la dirección solo contiene ciudad o región, OMITIR streetAddress — no poner ciudad ni región en ese campo.
   - "addressLocality": ciudad (${ubi.ciudad || 'usa lo disponible'})
   - "addressRegion": región (${ubi.region || 'usa lo disponible'})
   - "addressCountry": país (${ubi.pais || 'CL'})
${tieneCoords ? `6. "geo": {"@type": "GeoCoordinates", "latitude": ${ubi.lat}, "longitude": ${ubi.lng}}` : '6. Omitir campo "geo" (coordenadas no disponibles)'}
7. "occupancy": {"@type": "QuantitativeValue", "value": capacidad exacta como número}
8. "numberOfBedrooms": número de dormitorios (solo piezas para dormir)
9. "numberOfBathroomsTotal": número de baños
10. "amenityFeature": array con las amenidades verificadas. Cada una:
   {"@type": "LocationFeatureSpecification", "name": "[nombre]", "value": true, "description": "[sales_context]"}
   Usa el campo schema_type proporcionado si es diferente de LocationFeatureSpecification.
   Si el campo imageUrl de la amenidad NO es null, agrega "image": "[imageUrl]" en ese objeto.
   IMPORTANTE: amenityFeature es para cosas que el huésped valora al elegir (tinaja, parrilla, piscina, WiFi, TV, vista, etc.).
   NO incluyas ropa de cama, almohadas, cobertores, frazadas, muebles básicos ni artículos de inventario granular.
11. NO inventes amenidades fuera de la lista verificada
12. NO incluyas URLs de imágenes en el output excepto las que vengan en el campo imageUrl de las amenidades
13. NO incluyas "containsPlace" — se inyecta automáticamente desde los datos del sistema
14. NO incluyas "image" con URLs — se inyectan automáticamente desde la galería

REGLA ESPECIAL PARA HOTELES (tipoNegocio = 'hotel'):
- Si el alojamiento es una habitación de hotel, usa "@type": "HotelRoom" en lugar de los tipos anteriores
- Incluye "bed": {"@type": "BedDetails", "numberOfBeds": 1, "type": "QueenBed"} (ajusta según datos reales)

CAMPOS OPCIONALES RECOMENDADOS (inclúyelos si tienes la información):
- "priceRange": "$$" (basado en tarifas de la propiedad)
- "telephone": "${empresa.contactoTelefono || ''}" (teléfono de contacto)
- "checkinTime": "15:00", "checkoutTime": "11:00" (horarios estándar)
- "petsAllowed": false (a menos que se permitan mascotas)

REGLAS META SEO:
- metaTitle: [Nombre alojamiento] + [ciudad/región o gancho] — 55 a 72 caracteres, frase gramatical completa (nunca terminar en 'de la', 'en la', 'con un', etc.)
- metaDescription: Destaca el diferenciador principal + capacidad + CTA — máx 155 caracteres
- keywords: array de strings únicos, sin repetir metaTitle palabra por palabra; incluir variaciones útiles para búsqueda y asistentes (ej. "cabaña Pucón familia", "tinaja privada sur Chile")
- Si hay tinaja/hot tub/spa, es el diferenciador principal
- Si hay vista al lago/mar/montaña, es el segundo diferenciador
- Usar el idioma del contenido recibido (español si los datos están en español)

Responde SOLO con JSON válido (sin markdown, sin código de bloque):
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["...", "..."],
  "jsonLd": { ... objeto schema.org completo ... }
}`;
}

/**
 * Construye el prompt para generar JSON-LD + SEO desde el buildContext.
 *
 * @param {Object} params
 * @param {Object} params.buildContext — PropertyBuildContext completo
 * @returns {string} prompt listo para enviar a la IA
 */
function promptJsonLdYSeo({ buildContext }) {
    const { empresa, producto, narrativa, compartidas } = buildContext;

    const amenidadesNombres = new Set();
    const amenidades = [];
    (producto.espacios || []).forEach(espacio => {
        (espacio.activos || []).forEach(activo => {
            if (activo.schema_property !== 'amenityFeature') return;
            if (amenidadesNombres.has(activo.nombre)) return;
            amenidadesNombres.add(activo.nombre);
            amenidades.push({
                nombre: activo.nombre,
                schema_type: activo.schema_type,
                schema_property: activo.schema_property,
                capacity: activo.capacity || 0,
                sales_context: activo.sales_context || activo.nombre,
            });
        });
    });

    (compartidas || []).forEach(area => {
        const fotoUrl = area.fotos?.[0]?.storageUrl || null;
        amenidades.push({
            nombre: area.nombre,
            schema_type: 'LocationFeatureSpecification',
            schema_property: 'amenityFeature',
            capacity: 0,
            sales_context: area.nombre,
            imageUrl: fotoUrl,
        });
        (area.elementos || []).forEach(elem => {
            amenidades.push({
                nombre: elem.nombre,
                schema_type: 'LocationFeatureSpecification',
                schema_property: 'amenityFeature',
                capacity: elem.capacity || 0,
                sales_context: elem.nombre,
                imageUrl: null,
            });
        });
    });

    const espaciosResumen = (producto.espacios || []).map(e => ({
        nombre: e.nombre,
        categoria: e.categoria,
        numActivos: (e.activos || []).length,
    }));

    const ubi = empresa.ubicacion || {};
    const ubicacionLinea = [ubi.ciudad, ubi.region, ubi.pais].filter(Boolean).join(', ');
    const tieneCoords = ubi.lat && ubi.lng;

    const tipoNegocio = empresa.tipoNegocio || 'complejo';
    let schemaType;
    let additionalType;
    let schemaDescription;

    switch (tipoNegocio) {
        case 'hotel':
            schemaType = 'Hotel';
            additionalType = null;
            schemaDescription = 'hotel/hostal con habitaciones';
            break;
        case 'cartera':
            schemaType = ['Accommodation', 'Product'];
            additionalType = 'https://schema.org/VacationRental';
            schemaDescription = 'propiedad individual (cartera de departamentos)';
            break;
        case 'complejo':
        default:
            schemaType = 'LodgingBusiness';
            additionalType = null;
            schemaDescription = 'complejo turístico con múltiples unidades';
            break;
    }

    return withSsrCommerceObjective(
        buildJsonLdSeoPromptBody({
            empresa,
            producto,
            narrativa,
            tipoNegocio,
            schemaType,
            additionalType,
            schemaDescription,
            ubicacionLinea,
            ubi,
            tieneCoords,
            espaciosResumen,
            amenidades
        })
    );
}

module.exports = { promptJsonLdYSeo };
