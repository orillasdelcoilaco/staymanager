#!/usr/bin/env node
/**
 * backend/scripts/test_cabana10_jsonld.js
 *
 * Script para verificar la generación de JSON-LD para Cabaña 10
 * y validar que los datos sean consistentes con los componentes reales.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { contarDistribucion } = require('../services/propiedadLogicService');
const buildContextService = require('../services/buildContextService');

async function main() {
    console.log('=== VERIFICACIÓN DE JSON-LD PARA CABAÑA 10 ===\n');

    // ID de empresa y propiedad para Cabaña 10
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana10';

    try {
        // 1. Obtener datos de la propiedad
        console.log('1. DATOS DE CABAÑA 10:');
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

        // 2. Calcular baños y dormitorios desde componentes
        console.log('2. CÁLCULO DESDE COMPONENTES:');
        const { numPiezas: piezasCalculadas, numBanos: banosCalculados } = contarDistribucion(componentes);

        console.log(`   Dormitorios calculados: ${piezasCalculadas}`);
        console.log(`   Baños calculados: ${banosCalculados}\n`);

        // 3. Obtener buildContext
        console.log('3. BUILDCONTEXT PARA IA:');
        const buildContext = await buildContextService.getBuildContext(null, empresaId, propiedadId);

        if (buildContext && buildContext.producto) {
            console.log(`   producto.numBanos: ${buildContext.producto.numBanos}`);
            console.log(`   producto.numPiezas: ${buildContext.producto.numPiezas}`);
            console.log(`   producto.capacidad: ${buildContext.producto.capacidad}`);

            // Verificar consistencia
            const banosConsistentes = buildContext.producto.numBanos === banosCalculados;
            const piezasConsistentes = buildContext.producto.numPiezas === piezasCalculadas;

            console.log(`\n   ¿Consistente con cálculo?`);
            console.log(`   - Baños: ${banosConsistentes ? '✅ SÍ' : '❌ NO'} (buildContext: ${buildContext.producto.numBanos}, cálculo: ${banosCalculados})`);
            console.log(`   - Dormitorios: ${piezasConsistentes ? '✅ SÍ' : '❌ NO'} (buildContext: ${buildContext.producto.numPiezas}, cálculo: ${piezasCalculadas})`);
        } else {
            console.log('❌ No se pudo obtener buildContext');
        }

        // 4. Analizar componentes específicos
        console.log('\n4. ANÁLISIS DE COMPONENTES:');

        // Contar tipos de componentes
        const tiposComponentes = {};
        componentes.forEach(comp => {
            const tipo = comp.tipo || 'Sin tipo';
            tiposComponentes[tipo] = (tiposComponentes[tipo] || 0) + 1;
        });

        console.log('   Distribución por tipo:');
        Object.entries(tiposComponentes).forEach(([tipo, count]) => {
            console.log(`   - ${tipo}: ${count}`);
        });

        // Buscar baños específicamente
        const banos = componentes.filter(c => {
            const tipo = (c.tipo || '').toUpperCase();
            const nombre = (c.nombre || '').toUpperCase();
            return tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
                   nombre.includes('BANO') || nombre.includes('TOILET');
        });

        console.log(`\n   Baños detectados: ${banos.length}`);
        banos.forEach((bano, i) => {
            console.log(`   ${i + 1}. ${bano.nombre} (${bano.tipo || 'Sin tipo'})`);
        });

        // 5. Verificar amenidades
        console.log('\n5. AMENIDADES Y ACTIVOS:');

        // Obtener tipos de elemento
        const { rows: tiposRows } = await pool.query(
            `SELECT id, nombre, schema_property, sales_context, categoria
             FROM tipos_elemento WHERE empresa_id = $1`,
            [empresaId]
        );

        // Contar activos por componente
        let totalActivos = 0;
        let amenityFeatures = 0;
        let basicAssets = 0;

        componentes.forEach(comp => {
            const elementos = comp.elementos || [];
            totalActivos += elementos.length;

            elementos.forEach(elem => {
                const tipoElemento = tiposRows.find(t => t.id === elem.tipoId);
                if (tipoElemento?.schema_property === 'amenityFeature') {
                    amenityFeatures++;
                } else {
                    basicAssets++;
                }
            });
        });

        console.log(`   Total activos: ${totalActivos}`);
        console.log(`   🟢 Amenity Features: ${amenityFeatures}`);
        console.log(`   ⚪ Activos básicos: ${basicAssets}`);
        console.log(`   Proporción: ${Math.round((amenityFeatures / totalActivos) * 100)}% destacables\n`);

        // 6. Verificar JSON-LD esperado vs actual
        console.log('6. JSON-LD ESPERADO VS ACTUAL:');

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

        console.log(`   JSON-LD actual muestra:`);
        console.log(`   - Dormitorios: ${jsonldActual.numberOfBedrooms}`);
        console.log(`   - Baños: ${jsonldActual.numberOfBathroomsTotal}`);
        console.log(`   - Amenidades: ${jsonldActual.amenityFeature.length}`);
        console.log(`   - Espacios: ${jsonldActual.containsPlace.length}\n`);

        // 7. Comparación
        console.log('7. COMPARACIÓN Y CONCLUSIONES:');

        const dormitoriosCorrectos = jsonldActual.numberOfBedrooms === piezasCalculadas;
        const banosCorrectos = jsonldActual.numberOfBathroomsTotal === banosCalculados;

        console.log(`   Dormitorios: ${dormitoriosCorrectos ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
        console.log(`     JSON-LD: ${jsonldActual.numberOfBedrooms}, Cálculo: ${piezasCalculadas}`);

        console.log(`   Baños: ${banosCorrectos ? '✅ CORRECTO' : '❌ INCORRECTO'}`);
        console.log(`     JSON-LD: ${jsonldActual.numberOfBathroomsTotal}, Cálculo: ${banosCalculados}`);

        // Verificar que todos los espacios en JSON-LD existan en componentes
        const espaciosJsonld = jsonldActual.containsPlace.map(p => p.name);
        const espaciosComponentes = componentes.map(c => c.nombre);

        const espaciosFaltantes = espaciosJsonld.filter(espacio =>
            !espaciosComponentes.some(comp =>
                comp.toLowerCase().includes(espacio.toLowerCase()) ||
                espacio.toLowerCase().includes(comp.toLowerCase())
            )
        );

        if (espaciosFaltantes.length > 0) {
            console.log(`\n   ⚠️  Espacios en JSON-LD que no están en componentes:`);
            espaciosFaltantes.forEach(espacio => {
                console.log(`   - ${espacio}`);
            });
        } else {
            console.log(`\n   ✅ Todos los espacios en JSON-LD existen en componentes`);
        }

        // 8. Recomendaciones
        console.log('\n8. RECOMENDACIONES:');

        if (!dormitoriosCorrectos || !banosCorrectos) {
            console.log('   🔧 Ejecutar corrección:');
            console.log('   node backend/scripts/verify_and_fix_bathrooms.js --propiedad=cabana10 --fix');
        }

        if (espaciosFaltantes.length > 0) {
            console.log('   🔍 Revisar definición de componentes vs JSON-LD generado');
        }

        console.log('\n   📊 Resumen:');
        console.log(`   - Dormitorios: ${piezasCalculadas} (calculados)`);
        console.log(`   - Baños: ${banosCalculados} (calculados)`);
        console.log(`   - Activos: ${totalActivos} (${amenityFeatures} amenidades)`);
        console.log(`   - Componentes: ${componentes.length}`);

    } catch (error) {
        console.error('❌ Error durante la verificación:', error.message);
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

module.exports = { testCabana10Jsonld: main };