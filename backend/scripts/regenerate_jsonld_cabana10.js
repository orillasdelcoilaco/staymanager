#!/usr/bin/env node
/**
 * backend/scripts/regenerate_jsonld_cabana10.js
 *
 * Script para regenerar JSON-LD para Cabaña 10
 * y verificar que los datos sean correctos.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const buildContextService = require('../services/buildContextService');
const { contarDistribucion } = require('../services/propiedadLogicService');

async function main() {
    console.log('=== REGENERACIÓN DE JSON-LD PARA CABAÑA 10 ===\n');

    // ID de empresa y propiedad para Cabaña 10
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana10';

    try {
        // 1. Obtener datos de la propiedad
        console.log('1. OBTENIENDO DATOS DE LA PROPIEDAD:');
        const { rows: propRows } = await pool.query(
            `SELECT nombre, metadata FROM propiedades WHERE id = $1 AND empresa_id = $2`,
            [propiedadId, empresaId]
        );

        if (!propRows[0]) {
            console.log('❌ Propiedad no encontrada');
            return;
        }

        const propiedad = propRows[0];
        const meta = propiedad.metadata || {};
        const componentes = meta.componentes || [];

        console.log(`   Nombre: ${propiedad.nombre}`);
        console.log(`   Componentes: ${componentes.length}`);
        console.log(`   metadata.numBanos: ${meta.numBanos || 'No definido'}`);
        console.log(`   metadata.numPiezas: ${meta.numPiezas || 'No definido'}\n`);

        // 2. Calcular baños y dormitorios
        console.log('2. CÁLCULO DE BAÑOS Y DORMITORIOS:');
        const { numPiezas, numBanos } = contarDistribucion(componentes);
        console.log(`   Dormitorios calculados: ${numPiezas}`);
        console.log(`   Baños calculados: ${numBanos}\n`);

        // 3. Regenerar buildContext
        console.log('3. REGENERANDO BUILDCONTEXT:');
        const productoRegenerado = await buildContextService.construirProductoDesdeComponentes(null, empresaId, propiedadId);

        if (productoRegenerado) {
            console.log(`   producto.numBanos regenerado: ${productoRegenerado.numBanos}`);
            console.log(`   producto.numPiezas regenerado: ${productoRegenerado.numPiezas}`);
            console.log(`   producto.capacidad regenerado: ${productoRegenerado.capacidad}\n`);

            // 4. Obtener buildContext completo
            console.log('4. BUILDCONTEXT COMPLETO:');
            const buildContext = await buildContextService.getBuildContext(null, empresaId, propiedadId);

            if (buildContext && buildContext.producto) {
                console.log('   Datos del producto para IA:');
                console.log(`     - numBanos: ${buildContext.producto.numBanos}`);
                console.log(`     - numPiezas: ${buildContext.producto.numPiezas}`);
                console.log(`     - capacidad: ${buildContext.producto.capacidad}`);
                console.log(`     - nombre: ${buildContext.producto.nombre}`);
                console.log(`     - descripcion: ${buildContext.producto.descripcion?.substring(0, 100)}...\n`);

                // 5. Verificar amenidades
                console.log('5. AMENIDADES PARA JSON-LD:');

                // Obtener tipos de elemento
                const { rows: tiposRows } = await pool.query(
                    `SELECT id, nombre, schema_property, sales_context, categoria
                     FROM tipos_elemento WHERE empresa_id = $1`,
                    [empresaId]
                );

                // Encontrar amenity features
                const amenityFeatures = [];
                componentes.forEach(comp => {
                    const elementos = comp.elementos || [];
                    elementos.forEach(elem => {
                        const tipoElemento = tiposRows.find(t => t.id === elem.tipoId);
                        if (tipoElemento?.schema_property === 'amenityFeature') {
                            amenityFeatures.push({
                                nombre: elem.nombre,
                                tipoElemento: tipoElemento.nombre,
                                componente: comp.nombre,
                                sales_context: tipoElemento.sales_context
                            });
                        }
                    });
                });

                console.log(`   Total amenity features: ${amenityFeatures.length}`);
                amenityFeatures.forEach((amenity, i) => {
                    console.log(`   ${i + 1}. ${amenity.nombre} (${amenity.tipoElemento})`);
                    console.log(`       En: ${amenity.componente}`);
                    console.log(`       Contexto de venta: ${amenity.sales_context || 'N/A'}`);
                });

                // 6. Verificar espacios para containsPlace
                console.log('\n6. ESPACIOS PARA containsPlace:');

                const espaciosParaJsonLd = componentes.map(comp => {
                    const tipo = comp.tipo || '';
                    let schemaType = 'Room'; // Por defecto

                    // Mapear tipos a Schema.org
                    if (tipo.includes('Dormitorio') || tipo.includes('Bedroom')) {
                        schemaType = 'Bedroom';
                    } else if (tipo.includes('Terraza') || tipo.includes('Terrace')) {
                        schemaType = 'Terrace';
                    } else if (tipo.includes('Cocina') || tipo.includes('Kitchen')) {
                        schemaType = 'Kitchen';
                    } else if (tipo.includes('Baño') || tipo.includes('Bathroom')) {
                        schemaType = 'Bathroom';
                    } else if (tipo.includes('Living') || tipo.includes('Living Room')) {
                        schemaType = 'LivingRoom';
                    }

                    return {
                        nombre: comp.nombre,
                        tipo: comp.tipo,
                        schemaType: schemaType,
                        descripcion: tipo // Usar el tipo como descripción
                    };
                });

                console.log(`   Total espacios: ${espaciosParaJsonLd.length}`);
                espaciosParaJsonLd.forEach((espacio, i) => {
                    console.log(`   ${i + 1}. ${espacio.nombre} (${espacio.tipo}) → ${espacio.schemaType}`);
                });

                // 7. JSON-LD esperado
                console.log('\n7. JSON-LD ESPERADO:');

                const jsonldEsperado = {
                    "@context": "https://schema.org",
                    "@type": "LodgingBusiness",
                    "name": buildContext.producto.nombre || propiedad.nombre,
                    "description": buildContext.producto.descripcion || `Alojamiento en ${propiedad.nombre}`,
                    "numberOfBedrooms": buildContext.producto.numPiezas,
                    "numberOfBathroomsTotal": buildContext.producto.numBanos,
                    "occupancy": {
                        "@type": "QuantitativeValue",
                        "value": buildContext.producto.capacidad
                    },
                    "amenityFeature": amenityFeatures.map(amenity => ({
                        "@type": "LocationFeatureSpecification",
                        "name": amenity.nombre,
                        "value": true,
                        "description": amenity.sales_context || `Incluye ${amenity.nombre}`
                    })),
                    "containsPlace": espaciosParaJsonLd.map(espacio => ({
                        "@type": espacio.schemaType,
                        "name": espacio.nombre,
                        "description": espacio.descripcion
                    }))
                };

                console.log(`   Estructura básica:`);
                console.log(`   - Dormitorios: ${jsonldEsperado.numberOfBedrooms}`);
                console.log(`   - Baños: ${jsonldEsperado.numberOfBathroomsTotal}`);
                console.log(`   - Capacidad: ${jsonldEsperado.occupancy.value}`);
                console.log(`   - Amenidades: ${jsonldEsperado.amenityFeature.length}`);
                console.log(`   - Espacios: ${jsonldEsperado.containsPlace.length}\n`);

                // 8. Comparar con JSON-LD actual
                console.log('8. COMPARACIÓN CON JSON-LD ACTUAL:');

                // JSON-LD actual que mostraste
                const jsonldActual = {
                    numberOfBedrooms: 3,
                    numberOfBathroomsTotal: 2,
                    amenityFeature: [
                        { name: "TV Smart" },
                        { name: "Ducha Con Hidromasaje" },
                        { name: "Router Wifi" },
                        { name: "Silla De Terraza" },
                        { name: "Terraza Con Mesa" },
                        { name: "Bañera de Hidromasaje" },
                        { name: "Piscina" },
                        { name: "Quincho" }
                    ],
                    containsPlace: [
                        { name: "Dormitorio Principal en Suite", type: "Bedroom" },
                        { name: "Cocina", type: "Room" },
                        { name: "Baño", type: "Room" },
                        { name: "Comedor", type: "Room" },
                        { name: "Living", type: "Room" },
                        { name: "Terraza", type: "Terrace" },
                        { name: "Tinaja", type: "Room" },
                        { name: "Estacionamiento", type: "Room" },
                        { name: "Exterior", type: "Room" },
                        { name: "Dormitorio Matrimonial", type: "Bedroom" },
                        { name: "Dormitorio Camarotes", type: "Bedroom" }
                    ]
                };

                console.log(`   Dormitorios: ${jsonldActual.numberOfBedrooms === jsonldEsperado.numberOfBedrooms ? '✅' : '❌'} (actual: ${jsonldActual.numberOfBedrooms}, esperado: ${jsonldEsperado.numberOfBedrooms})`);
                console.log(`   Baños: ${jsonldActual.numberOfBathroomsTotal === jsonldEsperado.numberOfBathroomsTotal ? '✅' : '❌'} (actual: ${jsonldActual.numberOfBathroomsTotal}, esperado: ${jsonldEsperado.numberOfBathroomsTotal})`);

                // Verificar amenidades
                const amenidadesActuales = jsonldActual.amenityFeature.map(a => a.name);
                const amenidadesEsperadas = jsonldEsperado.amenityFeature.map(a => a.name);

                console.log(`\n   Amenidades actuales: ${amenidadesActuales.length}`);
                console.log(`   Amenidades esperadas: ${amenidadesEsperadas.length}`);

                // Verificar diferencias
                const faltantes = amenidadesEsperadas.filter(a => !amenidadesActuales.some(aa => aa.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(aa.toLowerCase())));
                const extras = amenidadesActuales.filter(a => !amenidadesEsperadas.some(ae => ae.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(ae.toLowerCase())));

                if (faltantes.length > 0) {
                    console.log(`   ⚠️  Amenidades faltantes en JSON-LD actual:`);
                    faltantes.forEach(f => console.log(`     - ${f}`));
                }

                if (extras.length > 0) {
                    console.log(`   ⚠️  Amenidades extras en JSON-LD actual:`);
                    extras.forEach(e => console.log(`     - ${e}`));
                }

                if (faltantes.length === 0 && extras.length === 0) {
                    console.log(`   ✅ Todas las amenidades coinciden`);
                }

                // 9. Recomendaciones
                console.log('\n9. RECOMENDACIONES:');

                if (jsonldActual.numberOfBedrooms !== jsonldEsperado.numberOfBedrooms ||
                    jsonldActual.numberOfBathroomsTotal !== jsonldEsperado.numberOfBathroomsTotal) {
                    console.log('   🔧 Regenerar JSON-LD para corregir datos básicos');
                }

                if (faltantes.length > 0 || extras.length > 0) {
                    console.log('   🔍 Revisar clasificación de amenidades en tipos_elemento');
                    console.log('      (schema_property debe ser "amenityFeature" para aparecer en JSON-LD)');
                }

                console.log('\n   📋 Resumen final:');
                console.log(`   - Datos básicos: ${jsonldActual.numberOfBedrooms === jsonldEsperado.numberOfBedrooms && jsonldActual.numberOfBathroomsTotal === jsonldEsperado.numberOfBathroomsTotal ? '✅ CORRECTOS' : '❌ INCORRECTOS'}`);
                console.log(`   - Amenidades: ${faltantes.length === 0 && extras.length === 0 ? '✅ COINCIDEN' : '⚠️  DIFERENCIAS'}`);
                console.log(`   - Espacios: ${jsonldActual.containsPlace.length === jsonldEsperado.containsPlace.length ? '✅ COINCIDEN' : '⚠️  DIFERENCIAS'}`);

            } else {
                console.log('❌ No se pudo obtener buildContext');
            }
        } else {
            console.log('❌ No se pudo regenerar el producto');
        }

    } catch (error) {
        console.error('❌ Error durante la regeneración:', error.message);
        console.error(error.stack);
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { regenerateJsonldCabana10: main };