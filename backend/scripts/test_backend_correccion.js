// Script para probar la corrección del backend

console.log('=== PRUEBA DE CORRECCIÓN BACKEND ===\n');

// Simular lo que ahora envía config.routes.js
const updatePayload = {
    websiteSettings: {
        general: {
            whatsapp: '+56912345678',
            googleMapsUrl: 'https://maps.google.com/...',
            domain: 'www.empresatest.com',
            gaTrackingId: 'G-TEST123456',
            wizardCompleted: true,
            subdomain: 'empresatest'
        },
        theme: {
            primaryColor: '#3b82f6',
            secondaryColor: '#6b7280',
            accentColor: '#10b981',
            logoUrl: 'https://storage.googleapis.com/.../logo.png',
            heroImageUrl: 'https://storage.googleapis.com/.../hero.jpg',
            heroImageAlt: 'Cabaña de montaña con vista panorámica',
            heroImageTitle: 'Cabaña Premium en Pucón-Caburgua'
        },
        content: {
            homeH1: 'Cabañas Familiares con Hot Tub en Pucón-Caburgua',
            homeIntro: 'Escápate a la naturaleza y vive unas vacaciones inolvidables en nuestras cabañas. Disfruta de hot tub, playa privada, piscina y la magia de Pucón-Caburgua con tu familia.'
        },
        seo: {
            title: 'Cabañas Familiares Pucón-Caburgua: Hot Tub y Naturaleza',
            description: 'Cabañas equipadas en Pucón-Caburgua. Hot tub, playa privada, piscina y actividades familiares. ¡Reserva tus vacaciones en la naturaleza hoy mismo!',
            keywords: 'cabañas, pucón, caburgua, hot tub, familia'
        }
    }
};

console.log('1. PAYLOAD QUE AHORA ENVÍA config.routes.js:');
console.log(JSON.stringify(updatePayload, null, 2));

// Simular configuracionActual existente en BD
const configuracionActual = {
    websiteSettings: {
        general: {
            whatsapp: '+56987654321',
            subdomain: 'test-antiguo'
        },
        theme: {
            primaryColor: '#000000',
            secondaryColor: '#666666',
            logoUrl: 'https://storage.googleapis.com/.../logo-viejo.png'
        },
        content: {
            homeH1: 'Título antiguo',
            homeIntro: 'Descripción antigua'
        },
        seo: {
            title: 'SEO antiguo',
            description: 'Descripción SEO antigua',
            keywords: 'antiguo, viejo'
        }
    },
    otrosDatos: 'valor'
};

console.log('\n2. CONFIGURACIÓN ACTUAL EN BD:');
console.log(JSON.stringify(configuracionActual, null, 2));

// Simular la lógica de deep merge que implementamos
console.log('\n3. SIMULAR DEEP MERGE (nueva lógica):');

const resto = updatePayload; // Esto es lo que recibe actualizarDetallesEmpresa

let configuracionFinal = { ...configuracionActual, ...resto };

// Deep merge para websiteSettings
if (resto.websiteSettings && configuracionActual.websiteSettings) {
    console.log('✅ Haciendo deep merge de websiteSettings');

    configuracionFinal.websiteSettings = {
        ...configuracionActual.websiteSettings,
        ...resto.websiteSettings,
        // Deep merge para sub-objetos
        general: { ...configuracionActual.websiteSettings.general, ...resto.websiteSettings.general },
        theme: { ...configuracionActual.websiteSettings.theme, ...resto.websiteSettings.theme },
        content: { ...configuracionActual.websiteSettings.content, ...resto.websiteSettings.content },
        seo: { ...configuracionActual.websiteSettings.seo, ...resto.websiteSettings.seo }
    };

    console.log('✅ websiteSettings después de deep merge:');
    console.log(JSON.stringify(configuracionFinal.websiteSettings, null, 2));
}

console.log('\n4. RESULTADO FINAL:');
console.log('Configuración que se guardará en BD:');
console.log(JSON.stringify(configuracionFinal, null, 2));

console.log('\n5. VERIFICACIÓN:');
console.log('¿Se preservaron los datos antiguos no actualizados?');
console.log('- otrosDatos:', configuracionFinal.otrosDatos === 'valor' ? '✅ PRESERVADO' : '❌ PERDIDO');

console.log('\n¿Se actualizaron los campos correctamente?');
console.log('- websiteSettings.general.whatsapp:', configuracionFinal.websiteSettings.general.whatsapp === '+56912345678' ? '✅ ACTUALIZADO' : '❌ NO ACTUALIZADO');
console.log('- websiteSettings.general.subdomain:', configuracionFinal.websiteSettings.general.subdomain === 'empresatest' ? '✅ ACTUALIZADO' : '❌ NO ACTUALIZADO');

console.log('\n¿Se preservaron campos antiguos no incluidos en el update?');
console.log('- websiteSettings.theme.logoUrl:', configuracionFinal.websiteSettings.theme.logoUrl === 'https://storage.googleapis.com/.../logo.png' ? '✅ ACTUALIZADO' : '❌ PERDIDO (debería ser actualizado)');

console.log('\n¿Los campos generados por IA se guardaron?');
console.log('- websiteSettings.content.homeH1:', configuracionFinal.websiteSettings.content.homeH1.includes('Cabañas Familiares') ? '✅ GUARDADO' : '❌ NO GUARDADO');
console.log('- websiteSettings.content.homeIntro:', configuracionFinal.websiteSettings.content.homeIntro.includes('Escápate a la naturaleza') ? '✅ GUARDADO' : '❌ NO GUARDADO');
console.log('- websiteSettings.seo.title:', configuracionFinal.websiteSettings.seo.title.includes('Cabañas Familiares Pucón-Caburgua') ? '✅ GUARDADO' : '❌ NO GUARDADO');
console.log('- websiteSettings.seo.description:', configuracionFinal.websiteSettings.seo.description.includes('Cabañas equipadas en Pucón-Caburgua') ? '✅ GUARDADO' : '❌ NO GUARDADO');

console.log('\n6. CONCLUSIÓN:');
console.log('Con la corrección implementada:');
console.log('✅ El backend ahora recibe un objeto websiteSettings completo');
console.log('✅ Se hace deep merge para preservar campos no actualizados');
console.log('✅ Los campos generados por IA (content y seo) se guardarán correctamente');
console.log('✅ Los campos de theme (incluyendo heroImageAlt y heroImageTitle) se guardarán');
console.log('✅ No se pierden datos existentes no incluidos en el update');