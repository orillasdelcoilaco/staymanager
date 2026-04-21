/**
 * aiEnums.js — Tipos de tareas de IA del sistema
 *
 * Define constantes para el routing centralizado de tareas de IA.
 * Cada tarea determina qué proveedor usar y qué sanitización aplicar.
 *
 * Proveedor por defecto de cada tarea (ver aiContentService.generateForTask):
 * - Groq: texto puro (CRM, SEO, propiedades, metadata, empresa)
 * - Gemini: tareas que requieren visión (imágenes con buffer o URL)
 */

const AI_TASK = {
    // Redacción de textos CRM: campañas, mensajes, borradores
    CRM_DRAFTING: 'CRM_DRAFTING',

    // Generación de metadatos SEO: metaTitle, metaDescription, h1, intro
    SEO_GENERATION: 'SEO_GENERATION',

    // Redacción de descripciones de propiedades para web pública
    PROPERTY_DESCRIPTION: 'PROPERTY_DESCRIPTION',

    // Extracción de estructura de alojamiento desde texto libre (componentes, ubicación)
    PROPERTY_STRUCTURE: 'PROPERTY_STRUCTURE',

    // Clasificación de activos del inventario: categoría, ícono, capacidad, tags SEO
    ASSET_METADATA: 'ASSET_METADATA',

    // Metadatos SEO de imagen con buffer de imagen (requiere visión)
    IMAGE_METADATA: 'IMAGE_METADATA',

    // Evaluación de fotografías según requerimientos del wizard (requiere visión)
    IMAGE_EVALUATION: 'IMAGE_EVALUATION',

    // Generación de perfil de empresa: slogan, enfoque, palabras clave
    COMPANY_PROFILE: 'COMPANY_PROFILE',

    // Plan de fotos por instancia de propiedad: shots requeridos por espacio para SEO/ventas/OTAs
    PHOTO_PLAN: 'PHOTO_PLAN',
};

/**
 * Proveedores preferidos por tipo de tarea.
 * 'gemini' para visión, 'groq' para texto puro.
 * Si el proveedor no tiene API key, cae al provider principal de aiConfig.
 */
const TASK_PROVIDER_MAP = {
    [AI_TASK.CRM_DRAFTING]:        'groq',
    [AI_TASK.SEO_GENERATION]:      'groq',
    [AI_TASK.PROPERTY_DESCRIPTION]:'groq',
    [AI_TASK.PROPERTY_STRUCTURE]:  'groq',
    [AI_TASK.ASSET_METADATA]:      'groq',
    [AI_TASK.IMAGE_METADATA]:      'gemini',
    [AI_TASK.IMAGE_EVALUATION]:    'gemini',
    [AI_TASK.COMPANY_PROFILE]:     'groq',
    [AI_TASK.PHOTO_PLAN]:          'groq',
};

/**
 * Límites de longitud por tipo de tarea para sanitización de inputs.
 * Protege contra prompt injection por inputs demasiado largos.
 */
const TASK_INPUT_LIMITS = {
    [AI_TASK.CRM_DRAFTING]:         2000,
    [AI_TASK.SEO_GENERATION]:       4200,
    [AI_TASK.PROPERTY_DESCRIPTION]: 3200,
    [AI_TASK.PROPERTY_STRUCTURE]:   5000,
    [AI_TASK.ASSET_METADATA]:        900,
    [AI_TASK.IMAGE_METADATA]:        500,
    [AI_TASK.IMAGE_EVALUATION]:     3000,
    [AI_TASK.COMPANY_PROFILE]:      3800,
    [AI_TASK.PHOTO_PLAN]:           6800,
};

module.exports = { AI_TASK, TASK_PROVIDER_MAP, TASK_INPUT_LIMITS };
