/**
 * backend/services/ai/corporateContent.js
 *
 * Funciones específicas para generación de contenido corporativo.
 * Separado de aiContentService.js para mantener modularidad.
 */

const { getProvider } = require('../aiContentService.providers');
const { withSsrCommerceObjective } = require('./prompts/ssrCommerceContext');
const { ssrCache } = require('../cacheService');

/**
 * Construye el prompt para contenido corporativo.
 */
function buildCompanyContext(contextoSanitizado) {
    const amenidadesStr = contextoSanitizado.amenidades?.length > 0
        ? contextoSanitizado.amenidades.join(', ')
        : 'No especificadas';
    return `CONTEXTO DE LA EMPRESA:
- Nombre: ${contextoSanitizado.nombre}
- Historia: ${contextoSanitizado.historia}
- Misión: ${contextoSanitizado.mision}
- Valores: ${contextoSanitizado.valores}
- Slogan: ${contextoSanitizado.slogan}
- Ubicación: ${contextoSanitizado.ubicacion.ciudad || ''}, ${contextoSanitizado.ubicacion.region || ''}, ${contextoSanitizado.ubicacion.pais || ''}
- Propuesta de valor: ${contextoSanitizado.brand.propuestaValor || ''}
- Tono de comunicación: ${contextoSanitizado.brand.tonoComunicacion || 'profesional'}
- Contacto: ${contextoSanitizado.contacto.telefonoPrincipal || ''}, ${contextoSanitizado.contacto.emailContacto || ''}
- Amenidades e instalaciones disponibles: ${amenidadesStr}

REGLA CRÍTICA: Cuando menciones amenidades o beneficios, DEBES referirte ÚNICAMENTE a las listadas arriba. Jamás inventes instalaciones ausentes.`;
}

function buildInstructions() {
    return `INSTRUCCIONES:
1. Genera contenido COHERENTE y CONSISTENTE con la identidad de marca
2. Usa el tono de comunicación especificado
3. Incluye llamados a la acción claros
4. Optimiza para SEO, conversión y compartidos en redes (home y páginas SSR públicas)
5. Mantén un estilo profesional pero cercano`;
}

function buildHomePageSchema() {
    return `  "homePage": {
    "hero": {
      "title": "Título principal H1 (máx 60 caracteres)",
      "subtitle": "Subtítulo atractivo (máx 120 caracteres)",
      "ctaText": "Texto del botón principal",
      "ctaLink": "/reservar"
    },
    "aboutPreview": {
      "title": "Título sección 'Sobre nosotros'",
      "content": "Texto introductorio (2-3 párrafos)",
      "ctaText": "Conoce nuestra historia →",
      "ctaLink": "/about"
    },
    "valueProposition": {
      "title": "Nuestra propuesta de valor",
      "points": [
        {
          "title": "Beneficio 1",
          "description": "Descripción breve",
          "icon": "fa-solid fa-star"
        }
      ]
    },
    "testimonials": {
      "title": "Lo que dicen nuestros huéspedes",
      "ctaText": "Ver todas las reseñas →",
      "ctaLink": "/resenas"
    }
  }`;
}

function buildAboutPageSchema() {
    return `  "aboutPage": {
    "hero": {
      "title": "Nuestra historia",
      "subtitle": "Conoce quiénes somos y nuestra pasión por el turismo"
    },
    "story": {
      "title": "Nuestra trayectoria",
      "content": "Texto narrativo de la historia (3-4 párrafos)"
    },
    "missionVision": {
      "mission": {
        "title": "Misión",
        "content": "Texto de la misión"
      },
      "vision": {
        "title": "Visión",
        "content": "Texto de la visión"
      },
      "values": {
        "title": "Nuestros valores",
        "items": ["Valor 1", "Valor 2", "Valor 3"]
      }
    },
    "team": {
      "title": "Nuestro equipo",
      "description": "Texto sobre el equipo (opcional)"
    }
  }`;
}

function buildContactPageSchema() {
    return `  "contactPage": {
    "hero": {
      "title": "Contáctanos",
      "subtitle": "Estamos aquí para ayudarte"
    },
    "contactInfo": {
      "title": "Información de contacto",
      "description": "Texto introductorio"
    },
    "form": {
      "title": "Envíanos un mensaje",
      "description": "Responderemos en menos de 24 horas"
    }
  }`;
}

function buildSeoSchema(contextoSanitizado) {
    return `  "seoGlobal": {
    "metaTitle": "Meta título global (50-60 caracteres)",
    "metaDescription": "Meta descripción global (120-160 caracteres)",
    "keywords": ["palabra1", "palabra2", "palabra3"],
    "structuredData": {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "${contextoSanitizado.nombre}",
      "description": "Meta descripción para schema.org",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "${contextoSanitizado.ubicacion.direccion || ''}",
        "addressLocality": "${contextoSanitizado.ubicacion.ciudad || ''}",
        "addressRegion": "${contextoSanitizado.ubicacion.region || ''}",
        "addressCountry": "${contextoSanitizado.ubicacion.pais || 'Chile'}"
      },
      "telephone": "${contextoSanitizado.contacto.telefonoPrincipal || ''}",
      "email": "${contextoSanitizado.contacto.emailContacto || ''}",
      "url": "${contextoSanitizado.baseUrl || ''}"
    }
  }`;
}

function buildPoliciesSchema() {
    return `  "policies": {
    "privacy": {
      "title": "Política de privacidad",
      "content": "Texto de política de privacidad"
    },
    "terms": {
      "title": "Términos y condiciones",
      "content": "Texto de términos y condiciones"
    },
    "cancellation": {
      "title": "Política de cancelación",
      "content": "Texto de política de cancelación"
    }
  }`;
}

function buildCorporatePrompt(contextoSanitizado) {
    const companyContext = buildCompanyContext(contextoSanitizado);
    const instructions = buildInstructions();
    const homePage = buildHomePageSchema();
    const aboutPage = buildAboutPageSchema();
    const contactPage = buildContactPageSchema();
    const seo = buildSeoSchema(contextoSanitizado);
    const policies = buildPoliciesSchema();

    return withSsrCommerceObjective(`Eres un Estratega de Marca y Copywriter especializado en turismo y alojamientos.
Genera contenido web corporativo completo basado en el contexto de la empresa.

${companyContext}

${instructions}

Responde SOLO con un objeto JSON válido con esta estructura exacta:

{
${homePage},
${aboutPage},
${contactPage},
${seo},
${policies}
}`);
}

/**
 * Sanitiza el contexto de empresa para IA.
 */
function sanitizeEmpresaContext(empresaContext) {
    // Normalizar amenidades: puede ser array de strings o de objetos {nombre}
    const amenidadesRaw = empresaContext.amenidades || [];
    const amenidades = amenidadesRaw
        .map(a => (typeof a === 'string' ? a : (a.nombre || a.name || '')))
        .filter(Boolean)
        .slice(0, 25);

    return {
        nombre: empresaContext.nombre || '',
        historia: empresaContext.historia || '',
        mision: empresaContext.mision || '',
        valores: Array.isArray(empresaContext.valores) ? empresaContext.valores.join(', ') : '',
        slogan: empresaContext.slogan || '',
        ubicacion: empresaContext.ubicacion || {},
        brand: empresaContext.brand || {},
        contacto: empresaContext.contacto || {},
        amenidades,
        baseUrl: empresaContext.baseUrl || '',
    };
}

/**
 * Construye el contenido de la página de inicio por defecto.
 */
function buildDefaultHomePage(nombre, ciudad, region) {
    return {
        hero: {
            title: `Bienvenido a ${nombre}`,
            subtitle: `Descubre los mejores alojamientos en ${ciudad}, ${region}`,
            ctaText: 'Ver alojamientos disponibles',
            ctaLink: '/propiedades'
        },
        aboutPreview: {
            title: 'Sobre nosotros',
            content: `En ${nombre} nos especializamos en ofrecer experiencias únicas de alojamiento. Nuestra pasión es conectar a los viajeros con los mejores lugares para crear recuerdos inolvidables.`,
            ctaText: 'Conoce nuestra historia',
            ctaLink: '/about'
        },
        valueProposition: {
            title: 'Por qué elegirnos',
            points: [
                {
                    title: 'Calidad garantizada',
                    description: 'Todos nuestros alojamientos pasan por rigurosos controles de calidad',
                    icon: 'fa-solid fa-star'
                },
                {
                    title: 'Atención personalizada',
                    description: 'Estamos disponibles 24/7 para ayudarte en lo que necesites',
                    icon: 'fa-solid fa-headset'
                },
                {
                    title: 'Mejor precio',
                    description: 'Ofrecemos las mejores tarifas sin costos ocultos',
                    icon: 'fa-solid fa-tag'
                }
            ]
        },
        testimonials: {
            title: 'Lo que dicen nuestros huéspedes',
            ctaText: 'Ver todas las reseñas',
            ctaLink: '/resenas'
        }
    };
}

/**
 * Construye el contenido de la página "Acerca de" por defecto.
 */
function buildDefaultAboutPage(nombre, ciudad) {
    return {
        hero: {
            title: 'Nuestra historia',
            subtitle: 'Conoce quiénes somos y nuestra pasión por el turismo'
        },
        story: {
            title: 'Nuestra trayectoria',
            content: `${nombre} nació con la visión de revolucionar la experiencia de alojamiento en ${ciudad}. A lo largo de los años, hemos crecido gracias a la confianza de nuestros huéspedes y nuestro compromiso con la excelencia en el servicio.`
        },
        missionVision: {
            mission: {
                title: 'Misión',
                content: 'Ofrecer experiencias de alojamiento memorables a través de un servicio excepcional y propiedades cuidadosamente seleccionadas.'
            },
            vision: {
                title: 'Visión',
                content: 'Ser la empresa líder en alojamientos turísticos en la región, reconocida por nuestra calidad y compromiso con los huéspedes.'
            },
            values: {
                title: 'Nuestros valores',
                items: ['Excelencia', 'Honestidad', 'Compromiso', 'Innovación', 'Pasión por el servicio']
            }
        },
        team: {
            title: 'Nuestro equipo',
            description: 'Contamos con un equipo de profesionales apasionados por el turismo y comprometidos con ofrecer la mejor experiencia a cada huésped.'
        }
    };
}

/**
 * Construye el contenido de la página de contacto por defecto.
 */
function buildDefaultContactPage() {
    return {
        hero: {
            title: 'Contáctanos',
            subtitle: 'Estamos aquí para ayudarte'
        },
        contactInfo: {
            title: 'Información de contacto',
            description: 'No dudes en comunicarte con nosotros para cualquier consulta, reserva o sugerencia.'
        },
        form: {
            title: 'Envíanos un mensaje',
            description: 'Responderemos en menos de 24 horas'
        }
    };
}

/**
 * Construye el SEO global por defecto.
 */
function buildDefaultSeoGlobal(nombre, ciudad, region) {
    return {
        metaTitle: `${nombre} - Alojamientos en ${ciudad}, ${region}`,
        metaDescription: `Descubre los mejores alojamientos en ${ciudad}, ${region}. ${nombre} ofrece experiencias únicas con servicio personalizado y las mejores tarifas.`,
        keywords: ['alojamiento', ciudad, region, 'turismo', 'vacaciones', 'cabañas', 'departamentos'],
        structuredData: {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": nombre,
            "description": `Empresa especializada en alojamientos turísticos en ${ciudad}, ${region}`,
            "address": {
                "@type": "PostalAddress",
                "addressLocality": ciudad,
                "addressRegion": region,
                "addressCountry": "Chile"
            }
        }
    };
}

/**
 * Construye las políticas por defecto.
 */
function buildDefaultPolicies() {
    return {
        privacy: {
            title: 'Política de privacidad',
            content: 'Respetamos tu privacidad y protegemos tus datos personales de acuerdo con la legislación vigente.'
        },
        terms: {
            title: 'Términos y condiciones',
            content: 'Al utilizar nuestros servicios, aceptas nuestros términos y condiciones de uso.'
        },
        cancellation: {
            title: 'Política de cancelación',
            content: 'Consulta nuestras políticas de cancelación y reembolso antes de realizar tu reserva.'
        }
    };
}

/**
 * Construye los metadatos por defecto.
 */
function buildDefaultMetadata(nombre) {
    return {
        generatedAt: new Date().toISOString(),
        empresaNombre: nombre,
        source: 'defaultCorporateContent',
        isFallback: true
    };
}

/**
 * Contenido corporativo por defecto (fallback).
 */
function getDefaultCorporateContent(empresaContext) {
    const nombre = empresaContext.nombre || 'Nuestra empresa';
    const ciudad = empresaContext.ubicacion?.ciudad || 'tu ciudad';
    const region = empresaContext.ubicacion?.region || 'tu región';

    return {
        homePage: buildDefaultHomePage(nombre, ciudad, region),
        aboutPage: buildDefaultAboutPage(nombre, ciudad),
        contactPage: buildDefaultContactPage(),
        seoGlobal: buildDefaultSeoGlobal(nombre, ciudad, region),
        policies: buildDefaultPolicies(),
        metadata: buildDefaultMetadata(nombre)
    };
}

/**
 * Genera contenido corporativo completo para SSR basado en el contexto de empresa.
 */
async function _generarContenidoCorporativoInterno(empresaContext) {
    try {
        const contextoSanitizado = sanitizeEmpresaContext(empresaContext);
        const prompt = buildCorporatePrompt(contextoSanitizado);
        const provider = getProvider();
        const result = await provider.generateJSON(prompt);

        return {
            ...result,
            metadata: {
                generatedAt: new Date().toISOString(),
                empresaId: empresaContext.id || '',
                empresaNombre: empresaContext.nombre || '',
                source: 'generarContenidoCorporativo',
            },
        };

    } catch (error) {
        console.error('[CorporateContent] Error generando contenido corporativo:', error);
        return getDefaultCorporateContent(empresaContext);
    }
}

async function generarContenidoCorporativo(empresaContext) {
    const empresaId = empresaContext.id;

    if (!empresaId) {
        console.warn('[CorporateContent] Sin empresaId, generando sin cache');
        return _generarContenidoCorporativoInterno(empresaContext);
    }

    try {
        // Usar cache con fallback a generación
        const content = await ssrCache.getOrGenerateCorporateContent(
            empresaId,
            () => _generarContenidoCorporativoInterno(empresaContext)
        );

        // Añadir metadata de cache si no está presente
        if (content && !content.metadata?.cacheInfo) {
            content.metadata = {
                ...content.metadata,
                cacheInfo: {
                    cached: true,
                    retrievedFromCache: true,
                    cacheTimestamp: new Date().toISOString()
                }
            };
        }

        return content;

    } catch (error) {
        console.error('[CorporateContent] Error en cache/generación:', error);
        // Fallback a contenido por defecto
        return getDefaultCorporateContent(empresaContext);
    }
}

module.exports = {
    generarContenidoCorporativo,
    getDefaultCorporateContent,
    sanitizeEmpresaContext,
    buildCorporatePrompt,
};