/**
 * Tooltips del menú lateral (atributo title). Rutas e ids sin cambiar — solo ayuda contextual.
 * Ver TASKS/tema/SM-spa-menu/plan-reorganizacion-menu-spa.md
 */

export const CATEGORY_HINTS = {
    operaciones:
        'Operación diaria del negocio: reservas, clientes, tarifas, canales de venta internos del PMS, integración iCal y bloqueos.',
    'gestion-propiedades':
        'Catálogo de lo que vendes: tipos de activos y espacios, alojamientos, fotos y normas.',
    'sitio-publico':
        'Tu sitio web público (SSR): contenido por alojamiento y configuración global del sitio.',
    'plataforma-suitemanagers':
        'Vista de plataforma (solo superadmin): monitoreo de posicionamiento y cobertura SEO de suitemanagers.com.',
    configuracion:
        'Ajustes de empresa, usuarios, plantillas, importación y herramientas administrativas.',
};

/** Por id de ítem de menú (data-path no cambia). */
export const ITEM_HINTS = {
    dashboard: 'Resumen y accesos rápidos.',
    'gestion-diaria': 'Panel de seguimiento operativo diario.',
    'espera-disponibilidad': 'Leads en espera por falta de disponibilidad y su estado de recontacto.',
    resenas: 'Reseñas de huéspedes publicadas en tu sitio.',
    'gestionar-reservas': 'Listado y gestión de reservas.',
    clientes: 'Base de clientes del tenant.',
    'gestionar-tarifas': 'Tarifas y temporadas por canal interno.',
    'gestionar-canales':
        'Canales de venta/reporte dentro del PMS (no son Google ni ChatGPT). Para feeds y Hotel Center → Canales IA.',
    'canales-ia': 'Feeds ARI/Google Hotels, semáforo e IDs externos por alojamiento.',
    'sincronizar-ical': 'Sincronización de calendarios por fuente (operación).',
    'gestionar-bloqueos': 'Bloqueos de disponibilidad.',
    'tipos-elemento': 'Tipos de activos (camas, equipamiento…).',
    'tipos-componente': 'Tipos de espacios (dormitorio, baño…).',
    'espacios-comunes': 'Instalaciones compartidas del recinto.',
    'gestionar-alojamientos': 'Armar cada alojamiento a partir de espacios y datos.',
    'galeria-propiedad': 'Galería de fotos por propiedad.',
    'normas-alojamiento': 'Normas de estadía (SSR y consistencia con IA).',
    'website-alojamientos': 'Textos y contenido web por alojamiento en tu sitio.',
    'website-general': 'Dominio, marca, legal, depósitos y ajustes globales del sitio público.',
    'seo-tenant': 'Diagnóstico SEO técnico de tu SSR: host, sitemap, robots, indexación y enlaces a Search Console/Bing.',
    'seo-plataforma': 'Monitoreo SEO del marketplace suitemanagers.com (solo superadministrador).',
    'config-empresa': 'Datos generales de la empresa.',
    'config-usuarios': 'Usuarios del panel.',
    'gestionar-plantillas': 'Plantillas de correo y mensajes.',
    'gestionar-dolar': 'Tipo de cambio referencial.',
    'procesar-consolidar': 'Herramientas de procesamiento de datos.',
    'historial-cargas': 'Historial de cargas masivas.',
    'config-conversion': 'Conversión de datos históricos.',
    'mapeo-reportes': 'Mapeo de columnas en reportes.',
    'mapeos-centrales': 'Mapeos OTA centralizados.',
    'config-google': 'OAuth Google Contacts.',
    'gestionar-tipos-plantilla': 'Tipos de plantilla.',
    'gestionar-estados': 'Estados de gestión de reserva.',
    'importador-magico': 'Importación asistida.',
    'importador-historico': 'Importación histórica.',
};
