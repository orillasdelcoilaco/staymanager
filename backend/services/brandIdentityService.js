/**
 * backend/services/brandIdentityService.js
 *
 * Servicio para gestionar identidad visual corporativa.
 * Integra configuración de marca (colores, logos, tipografía) con el sistema de tokens.
 *
 * Principios:
 * 1. Todo configurable desde UI (sistema paramétrico)
 * 2. Integración con tokens de color existentes (tailwind.config.js)
 * 3. Fallback a configuración por defecto si no hay personalización
 */

const pool = require('../db/postgres');

/**
 * Extrae y procesa la configuración de marca desde la base de datos.
 */
function extractBrandConfig(cfg) {
    const websiteSettings = cfg.websiteSettings || {};
    const brand = websiteSettings.brand || {};
    const paletaColores = brand.paletaColores || {};

    return {
        brand,
        paletaColores,
        websiteSettings,
    };
}

/**
 * Construye la paleta de colores procesada.
 */
function buildColorPalette(paletaColores) {
    return {
        primary: paletaColores.primary || mapColorToToken(paletaColores.primaryHex, 'primary'),
        secondary: paletaColores.secondary || mapColorToToken(paletaColores.secondaryHex, 'primary'),
        accent: paletaColores.accent || mapColorToToken(paletaColores.accentHex, 'primary'),
        neutral: paletaColores.neutral || mapColorToToken(paletaColores.neutralHex, 'gray'),
        success: paletaColores.success || 'success-500',
        warning: paletaColores.warning || 'warning-500',
        danger: paletaColores.danger || 'danger-500',
    };
}

/**
 * Construye la configuración visual completa.
 */
function buildVisualConfig(brand) {
    return {
        colors: buildColorPalette(brand.paletaColores || {}),
        logos: brand.logos || {
            primary: null,
            secondary: null,
            favicon: null,
            marcaAgua: null,
        },
        typography: brand.tipografia || {
            fontFamily: 'Inter',
            heading: { size: '1.5rem', weight: '600' },
            body: { size: '0.875rem', weight: '400' },
            caption: { size: '0.75rem', weight: '400' },
        },
        spacing: brand.spacing || {
            base: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem',
        },
        borderRadius: brand.borderRadius || {
            sm: '0.125rem',
            md: '0.375rem',
            lg: '0.5rem',
            xl: '0.75rem',
            '2xl': '1rem',
        },
    };
}

/**
 * Construye elementos de diseño.
 */
function buildDesignElements(brand) {
    return {
        shadows: brand.shadows || {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        },
        gradients: brand.gradients || {
            primary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        },
        patterns: brand.patterns || {
            texture: null,
            overlay: null,
        },
    };
}

/**
 * Construye configuración de componentes.
 */
function buildComponentsConfig() {
    return {
        buttons: {
            primary: 'btn-primary',
            secondary: 'btn-outline',
            danger: 'btn-danger',
            success: 'btn-success',
            ghost: 'btn-ghost',
        },
        cards: {
            default: 'bg-white rounded-xl border border-gray-100 shadow-card',
            elevated: 'bg-white rounded-2xl border border-gray-100 shadow-lg',
        },
        forms: {
            input: 'form-input',
            select: 'form-select',
            file: 'form-input-file',
        },
    };
}

/**
 * Obtiene la identidad visual completa de una empresa.
 * Combina configuración de marca con tokens por defecto.
 *
 * @param {string} empresaId
 * @returns {Promise<Object>} identidad visual completa
 */
async function getBrandIdentity(empresaId) {
    if (!pool) {
        return getDefaultBrandIdentity();
    }

    try {
        const { rows } = await pool.query(
            `SELECT configuracion FROM empresas WHERE id = $1`,
            [empresaId]
        );

        if (!rows[0]) {
            return getDefaultBrandIdentity();
        }

        const cfg = rows[0].configuracion || {};
        const { brand } = extractBrandConfig(cfg);

        return {
            brand: {
                propuestaValor: brand.propuestaValor || '',
                tonoComunicacion: brand.tonoComunicacion || 'profesional',
                posicionamiento: brand.posicionamiento || '',
                experienciaCliente: brand.experienciaCliente || '',
                estiloVisual: brand.estiloVisual || 'moderno',
            },
            visual: buildVisualConfig(brand),
            designElements: buildDesignElements(brand),
            components: buildComponentsConfig(),
            metadata: {
                lastUpdated: new Date().toISOString(),
                source: 'brandIdentityService',
                version: '1.0.0',
            },
        };

    } catch (error) {
        console.error('[BrandIdentityService] Error obteniendo identidad visual:', error);
        return getDefaultBrandIdentity();
    }
}

/**
 * Identidad visual por defecto (fallback).
 * Usa tokens semánticos del sistema.
 */
function getDefaultBrandIdentity() {
    return {
        brand: {
            propuestaValor: '',
            tonoComunicacion: 'profesional',
            posicionamiento: '',
            experienciaCliente: '',
            estiloVisual: 'moderno',
        },

        visual: {
            colors: {
                primary: 'primary-500',
                secondary: 'primary-400',
                accent: 'primary-300',
                neutral: 'gray-500',
                success: 'success-500',
                warning: 'warning-500',
                danger: 'danger-500',
            },

            logos: {
                primary: null,
                secondary: null,
                favicon: null,
                marcaAgua: null,
            },

            typography: {
                fontFamily: 'Inter',
                heading: { size: '1.5rem', weight: '600' },
                body: { size: '0.875rem', weight: '400' },
                caption: { size: '0.75rem', weight: '400' },
            },

            spacing: {
                base: '0.25rem',
                sm: '0.5rem',
                md: '1rem',
                lg: '1.5rem',
                xl: '2rem',
            },

            borderRadius: {
                sm: '0.125rem',
                md: '0.375rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
            },
        },

        designElements: {
            shadows: {
                sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            },

            gradients: {
                primary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            },

            patterns: {
                texture: null,
                overlay: null,
            },
        },

        components: {
            buttons: {
                primary: 'btn-primary',
                secondary: 'btn-outline',
                danger: 'btn-danger',
                success: 'btn-success',
                ghost: 'btn-ghost',
            },

            cards: {
                default: 'bg-white rounded-xl border border-gray-100 shadow-card',
                elevated: 'bg-white rounded-2xl border border-gray-100 shadow-lg',
            },

            forms: {
                input: 'form-input',
                select: 'form-select',
                file: 'form-input-file',
            },
        },

        metadata: {
            lastUpdated: new Date().toISOString(),
            source: 'default',
            version: '1.0.0',
        },
    };
}

/**
 * Mapea un color HEX a un token semántico.
 * Si no se puede mapear, usa el token por defecto.
 *
 * @param {string} hexColor - Color en formato HEX (#RRGGBB)
 * @param {string} defaultToken - Token por defecto (ej: 'primary-500')
 * @returns {string} token semántico
 */
function mapColorToToken(hexColor, defaultTokenType = 'primary') {
    if (!hexColor || !/^#[0-9A-F]{6}$/i.test(hexColor)) {
        return `${defaultTokenType}-500`;
    }

    // Mapeo simple de colores HEX a tokens
    // En una implementación real, esto podría usar una librería de color
    // para encontrar el token más cercano

    const colorMap = {
        '#6366f1': 'primary-500',
        '#4f46e5': 'primary-600',
        '#4338ca': 'primary-700',
        '#ef4444': 'danger-500',
        '#dc2626': 'danger-600',
        '#b91c1c': 'danger-700',
        '#22c55e': 'success-500',
        '#16a34a': 'success-600',
        '#15803d': 'success-700',
        '#f59e0b': 'warning-500',
        '#d97706': 'warning-600',
        '#b45309': 'warning-700',
        '#6b7280': 'gray-500',
        '#4b5563': 'gray-600',
        '#374151': 'gray-700',
    };

    return colorMap[hexColor.toLowerCase()] || `${defaultTokenType}-500`;
}

/**
 * Genera CSS personalizado basado en colores HEX de marca configurados por la empresa.
 * Solo genera CSS cuando hay colores HEX reales definidos (no tokens Tailwind).
 * Soporta tanto el formato completo de getBrandIdentity() como el slim de website.js.
 *
 * @param {Object} brandIdentity - Identidad visual (formato completo o slim)
 * @returns {string} CSS personalizado con variables de color de marca
 */
function generateCustomCSS(brandIdentity) {
    // Soporte para formato completo (getBrandIdentity) y slim (website.js middleware)
    const colors = brandIdentity?.visual?.colors || brandIdentity?.colors || {};
    const typography = brandIdentity?.visual?.typography || brandIdentity?.typography || {};

    // Extraer solo colores HEX cuando estén definidos — los tokens Tailwind no son CSS vars válidas
    const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
    const primaryHex   = HEX_PATTERN.test(colors.primaryHex)   ? colors.primaryHex   : null;
    const secondaryHex = HEX_PATTERN.test(colors.secondaryHex) ? colors.secondaryHex : null;
    const accentHex    = HEX_PATTERN.test(colors.accentHex)    ? colors.accentHex    : null;

    // Sin colores personalizados — no generar CSS innecesario
    if (!primaryHex && !secondaryHex && !accentHex) {
        return '/* Sin colores de marca personalizados configurados */';
    }

    const fontFamily = typography?.fontFamily || 'Inter';

    let cssVars = ':root {\n';
    if (primaryHex)   cssVars += `    --color-brand-primary: ${primaryHex};\n`;
    if (secondaryHex) cssVars += `    --color-brand-secondary: ${secondaryHex};\n`;
    if (accentHex)    cssVars += `    --color-brand-accent: ${accentHex};\n`;
    cssVars += `    --font-brand: '${fontFamily}', ui-sans-serif, system-ui, sans-serif;\n`;
    cssVars += '}\n';

    let utilityClasses = '';
    if (primaryHex) {
        utilityClasses += `.brand-bg-primary { background-color: var(--color-brand-primary); }
.brand-text-primary { color: var(--color-brand-primary); }
.brand-border-primary { border-color: var(--color-brand-primary); }
`;
    }
    if (secondaryHex) {
        utilityClasses += `.brand-bg-secondary { background-color: var(--color-brand-secondary); }
.brand-text-secondary { color: var(--color-brand-secondary); }
`;
    }

    return `/* CSS de marca generado dinámicamente */\n${cssVars}${utilityClasses}`;
}

/**
 * Valida que la identidad visual sea compatible con el sistema de tokens.
 *
 * @param {Object} brandConfig - Configuración de marca a validar
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
function validateBrandConfig(brandConfig) {
    const errors = [];
    const warnings = [];

    // Validar colores
    if (brandConfig.paletaColores) {
        const colors = brandConfig.paletaColores;

        // Verificar que los colores HEX sean válidos
        Object.entries(colors).forEach(([key, value]) => {
            if (key.includes('Hex') && value && !/^#[0-9A-F]{6}$/i.test(value)) {
                errors.push(`Color HEX inválido para ${key}: ${value}`);
            }
        });
    }

    // Validar que no se usen colores Tailwind hardcodeados
    const hardcodedColors = ['blue-', 'red-', 'green-', 'yellow-', 'indigo-', 'purple-'];
    const configStr = JSON.stringify(brandConfig).toLowerCase();

    hardcodedColors.forEach(color => {
        if (configStr.includes(color)) {
            warnings.push(`Posible uso de color Tailwind hardcodeado: ${color}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

module.exports = {
    getBrandIdentity,
    getDefaultBrandIdentity,
    generateCustomCSS,
    validateBrandConfig,
    mapColorToToken,
};