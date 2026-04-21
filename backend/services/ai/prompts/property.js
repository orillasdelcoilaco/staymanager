/**
 * property.js — Prompts para propiedades y estructura de alojamientos
 *
 * Centraliza los prompts relacionados a:
 * - Descripción comercial de propiedades
 * - Extracción de estructura (componentes + ubicación) desde texto libre
 * - Metadata de activos del inventario
 */

const { withSsrCommerceObjective } = require('./ssrCommerceContext');

/**
 * Prompt para generar descripción comercial de un alojamiento.
 *
 * @param {object} p
 * @param {string} p.nombre
 * @param {string} p.tipo
 * @param {string} p.ubicacion
 * @param {string} p.servicios
 * @param {string} [p.estilo]
 * @param {Array|null} [p.espaciosConActivos] — Si se pasa, reemplaza "servicios" con inventario verificado
 * @returns {string}
 */
function promptDescripcionAlojamiento({ nombre, tipo, ubicacion, servicios, estilo = 'Comercial y atractivo', espaciosConActivos = null }) {
    const inventarioSection = espaciosConActivos
        ? `INVENTARIO VERIFICADO POR ESPACIO:
${espaciosConActivos.map(e =>
    `${e.nombre}: ${(e.activos || []).map(a => a.sales_context || a.nombre).join(', ')}`
).join('\n')}`
        : `- Servicios clave: ${servicios}`;

    return withSsrCommerceObjective(`Actúa como Copywriter Inmobiliario especializado en alojamientos turísticos.
Escribe una descripción para la siguiente propiedad:

- Nombre: "${nombre}"
- Tipo: ${tipo}
- Ubicación: "${ubicacion}"
- Estilo de redacción: "${estilo}"
${inventarioSection}

REGLAS:
1. Texto persuasivo, orientado a conversión de reservas.
2. No inventes servicios que no estén en la lista.
3. Máximo 200 palabras para "descripcion".
4. "puntosFuertes": 3 a 5 bullets cortos, en español.

Responde SOLO JSON (sin markdown):
{
    "descripcion": "Texto persuasivo...",
    "puntosFuertes": ["punto1", "punto2", "punto3"]
}`);
}

/**
 * Prompt para extraer estructura de alojamiento desde descripción libre.
 *
 * @param {object} p
 * @param {string} p.descripcion — Texto libre del usuario sobre el alojamiento
 * @param {string} p.tiposInfo — Lista formateada de tipos disponibles en el sistema
 * @returns {string}
 */
function promptEstructuraAlojamiento({ descripcion, tiposInfo }) {
    return withSsrCommerceObjective(`Actúa como un Arquitecto de Datos para un Property Management System (PMS).

Analiza la siguiente descripción de un alojamiento y extrae su estructura de inventario:

DESCRIPCIÓN:
"${descripcion}"

TIPOS DE COMPONENTES DISPONIBLES EN EL SISTEMA:
${tiposInfo}

INSTRUCCIONES:
1. Extrae todos los elementos físicos mencionados (camas, baños, cocina, etc.).
2. Para cada componente, usa el tipo más cercano de la lista disponible.
3. Si no hay tipo exacto, usa el más parecido.
4. "ubicacion": ciudad, región o país si se menciona.
5. No inventes componentes que no estén en la descripción.

Responde SOLO JSON (sin markdown):
{
    "ubicacion": {
        "ciudad": "...",
        "region": "...",
        "pais": "Chile"
    },
    "componentes": [
        { "tipoId": "id-del-tipo", "cantidad": 1, "nombre": "Nombre del tipo" }
    ]
}`);
}

/**
 * Prompt para clasificar un activo del inventario (metadata + SEO).
 *
 * @param {object} p
 * @param {string} p.nombreActivo
 * @param {string} p.categoriasExistentes — JSON.stringify del array de categorías
 * @returns {string}
 */
function promptMetadataActivo({ nombreActivo, categoriasExistentes }) {
    return withSsrCommerceObjective(`Actúa como un Arquitecto de Información experto en Hospitalidad, SEO y gestión de inventarios.
Tu tarea es analizar el activo de alojamiento: "${nombreActivo}".

CONTEXTO:
Categorías existentes en el sistema: ${categoriasExistentes}.

OBJETIVO:
Generar el perfil completo del activo para usarlo en:
1. Gestión de inventario del alojamiento
2. SEO para motores de búsqueda (Google Hotels, Booking.com)
3. Contexto de venta para agentes IA
4. Schema.org para datos estructurados

REGLAS:
1. Si el activo encaja en una categoría existente, ÚSALA (Title Case).
2. Si no encaja, propón una categoría nueva profesional.
3. Determina si es contable (múltiples unidades) o binario (tiene/no tiene).
4. Usa un EMOJI representativo.
5. "sales_context": frase corta en español para agente de ventas (ej: "Cama King para 2 personas").
6. "seo_tags": palabras clave en español que los huéspedes usan al buscar.
7. "schema_type": usa tipos de Schema.org para alojamientos.
8. "schema_property": clasifica según la regla siguiente:
   - USA "amenityFeature" SOLO para elementos que el huésped valora al ELEGIR el alojamiento:
     piscina, tinaja, jacuzzi, parrilla, BBQ, sauna, vista al lago/mar/montaña, WiFi, Netflix,
     Smart TV, kayak, bicicleta, cancha, spa, sala de juegos, estacionamiento, bote, fogón, deck, terraza.
   - USA null para artículos de inventario granular que el huésped da por sentado o no influyen
     en la elección: ropa de cama, almohadas, sábanas, frazadas, cobertores, toallas, vajilla,
     cubiertos, muebles básicos (velador, closet, silla), electrodomésticos menores (tostadora, secador).
   - En caso de duda, prefiere null sobre amenityFeature.

Responde SOLO JSON (sin markdown):
{
    "category": "String (Title Case)",
    "is_new_category": false,
    "capacity": 0,
    "icon": "Emoji",
    "countable": true,
    "confidence": "High",
    "reasoning": "Breve explicación",
    "normalized_name": "Nombre correcto en Title Case",
    "requires_photo": false,
    "photo_quantity": 0,
    "photo_guidelines": "Instrucción breve para fotografiar",
    "seo_tags": ["tag1", "tag2", "tag3"],
    "sales_context": "Frase corta para agente de ventas",
    "schema_type": "LocationFeatureSpecification",
    "schema_property": null
}`);
}

module.exports = { promptDescripcionAlojamiento, promptEstructuraAlojamiento, promptMetadataActivo };
