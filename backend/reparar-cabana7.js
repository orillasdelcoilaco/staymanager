#!/usr/bin/env node
/**
 * Script específico para reparar Cabaña 7
 * Problema: Todos los elementos tienen capacity=0 y no hay camas definidas
 */

require('dotenv').config({ path: '.env' });

console.log('🔧 REPARADOR ESPECÍFICO CABAÑA 7');
console.log('='.repeat(60));

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no definida');
    process.exit(1);
}

const pool = require('./db/postgres');

if (!pool) {
    console.error('❌ PostgreSQL no configurado');
    process.exit(1);
}

console.log('✅ Conectado a PostgreSQL');

// Función para determinar capacity por nombre
function determinarCapacityPorNombre(nombre) {
    if (!nombre) return 0;

    const n = nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Camas dobles
    if (n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') ||
        n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS')) {
        return 2;
    }

    // Literas, camarotes
    if (n.includes('LITERA') || n.includes('CAMAROTE')) {
        return 2;
    }

    // Camas simples
    if (n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') ||
        n.includes('NIDO') || n.includes('CATRE') || n.includes('SIMPLE')) {
        return 1;
    }

    // Sofás cama
    if (n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED')) {
        return 1;
    }

    // Camas genéricas
    if (n.includes('CAMA') || n.includes('BED')) {
        return 1;
    }

    // No es cama
    return 0;
}

// Función para agregar camas faltantes a Cabaña 7
function agregarCamasFaltantes(componentes) {
    console.log('   🔍 Analizando estructura actual...');

    // Buscar componentes de dormitorio
    const dormitorios = componentes.filter(comp =>
        comp.nombre && (
            comp.nombre.toLowerCase().includes('dormitorio') ||
            comp.nombre.toLowerCase().includes('suite') ||
            comp.nombre.toLowerCase().includes('habitación') ||
            comp.nombre.toLowerCase().includes('habitacion')
        )
    );

    console.log(`   📊 Dormitorios encontrados: ${dormitorios.length}`);

    // Si no hay dormitorios con elementos de cama, agregarlos
    let camasAgregadas = 0;
    const nuevosComponentes = [...componentes];

    dormitorios.forEach((dorm, idx) => {
        const tieneCamas = dorm.elementos && dorm.elementos.some(el =>
            el.nombre && (
                el.nombre.toLowerCase().includes('cama') ||
                el.nombre.toLowerCase().includes('bed') ||
                el.nombre.toLowerCase().includes('litera') ||
                el.nombre.toLowerCase().includes('camarote')
            )
        );

        if (!tieneCamas) {
            console.log(`   🛏️  Dormitorio "${dorm.nombre}" no tiene camas definidas`);

            // Agregar camas según el dormitorio
            let camasAAgregar = [];

            if (dorm.nombre.toLowerCase().includes('principal')) {
                // Dormitorio principal: cama matrimonial
                camasAAgregar.push({
                    nombre: 'Cama Matrimonial',
                    cantidad: 1,
                    capacity: 2,
                    tipoId: 'cama'
                });
                console.log(`     + Cama Matrimonial (2 personas)`);
                camasAgregadas += 2;
            } else {
                // Dormitorios secundarios: camas individuales o literas
                // Para Cabaña 7 (6 personas): ya tenemos 2 en principal, necesitamos 4 más
                if (idx === 1) { // Segundo dormitorio
                    camasAAgregar.push({
                        nombre: 'Camarote (Litera)',
                        cantidad: 1,
                        capacity: 2,
                        tipoId: 'litera'
                    });
                    console.log(`     + Camarote/Litera (2 personas)`);
                    camasAgregadas += 2;
                } else if (idx === 2) { // Tercer dormitorio
                    camasAAgregar.push({
                        nombre: 'Cama Individual',
                        cantidad: 2,
                        capacity: 1,
                        tipoId: 'cama'
                    });
                    console.log(`     + 2 Camas Individuales (2 personas)`);
                    camasAgregadas += 2;
                }
            }

            if (camasAAgregar.length > 0) {
                // Encontrar el índice del dormitorio
                const dormIndex = nuevosComponentes.findIndex(c => c.nombre === dorm.nombre);
                if (dormIndex !== -1) {
                    nuevosComponentes[dormIndex].elementos = [
                        ...(nuevosComponentes[dormIndex].elementos || []),
                        ...camasAAgregar
                    ];
                }
            }
        } else {
            console.log(`   ✅ Dormitorio "${dorm.nombre}" ya tiene camas`);
        }
    });

    console.log(`   📈 Camas agregadas: ${camasAgregadas} personas de capacidad`);
    return { nuevosComponentes, camasAgregadas };
}

// Función para reparar elementos con capacity=0
function repararElementos(componentes) {
    console.log('   🔧 Reparando elementos con capacity=0...');

    let contadorReparados = 0;
    const componentesReparados = componentes.map(comp => {
        if (!Array.isArray(comp.elementos)) return comp;

        const nuevosElementos = comp.elementos.map(el => {
            // Solo reparar si capacity=0 y el nombre sugiere que es cama
            if (el.capacity === 0 && el.nombre) {
                const capacidadPorNombre = determinarCapacityPorNombre(el.nombre);
                if (capacidadPorNombre > 0) {
                    contadorReparados++;
                    console.log(`     🔧 ${el.nombre}: 0 → ${capacidadPorNombre}`);
                    return { ...el, capacity: capacidadPorNombre };
                }
            }
            return el;
        });

        return {
            ...comp,
            elementos: nuevosElementos
        };
    });

    console.log(`   📊 Elementos reparados: ${contadorReparados}`);
    return componentesReparados;
}

async function repararCabana7() {
    console.log('\n🔍 Buscando Cabaña 7...');

    try {
        // Obtener Cabaña 7
        const { rows } = await pool.query(
            "SELECT * FROM propiedades WHERE id = 'cabana-7'"
        );

        if (rows.length === 0) {
            console.error('❌ Cabaña 7 no encontrada');
            return;
        }

        const cabana7 = rows[0];
        console.log(`✅ Encontrada: ${cabana7.nombre}`);
        console.log(`   Capacidad actual: ${cabana7.capacidad}`);
        console.log(`   Componentes: ${cabana7.metadata?.componentes?.length || 0}`);

        const componentesOriginales = cabana7.metadata?.componentes || [];
        console.log(`   Elementos totales: ${componentesOriginales.reduce((sum, comp) => sum + (comp.elementos?.length || 0), 0)}`);

        // PASO 1: Agregar camas faltantes
        console.log('\n📦 PASO 1: Agregar camas faltantes');
        const { nuevosComponentes, camasAgregadas } = agregarCamasFaltantes(componentesOriginales);

        // PASO 2: Reparar elementos con capacity=0
        console.log('\n🔧 PASO 2: Reparar capacity=0');
        const componentesReparados = repararElementos(nuevosComponentes);

        // Calcular nueva capacidad
        const { calcularCapacidad } = require('./services/propiedadLogicService');
        const capacidadCalculada = calcularCapacidad(componentesReparados);

        console.log('\n🧮 RESULTADOS:');
        console.log(`   Capacidad original en BD: ${cabana7.capacidad}`);
        console.log(`   Capacidad calculada después: ${capacidadCalculada}`);
        console.log(`   Camas agregadas: ${camasAgregadas} personas`);

        // Actualizar en la base de datos
        console.log('\n💾 Actualizando base de datos...');

        const nuevoMetadata = {
            ...cabana7.metadata,
            componentes: componentesReparados
        };

        await pool.query(
            'UPDATE propiedades SET metadata = $1, capacidad = $2 WHERE id = $3 AND empresa_id = $4',
            [JSON.stringify(nuevoMetadata), capacidadCalculada, cabana7.id, cabana7.empresa_id]
        );

        console.log(`✅ Cabaña 7 actualizada`);
        console.log(`   Nueva capacidad: ${capacidadCalculada}`);

        // Verificar
        console.log('\n🔍 Verificando actualización...');
        const { rows: updatedRows } = await pool.query(
            "SELECT capacidad, metadata->'componentes' as componentes FROM propiedades WHERE id = 'cabana-7'"
        );

        if (updatedRows.length > 0) {
            const updated = updatedRows[0];
            console.log(`   Capacidad en BD después: ${updated.capacidad}`);

            // Contar camas
            const componentes = updated.componentes || [];
            let totalCamas = 0;
            let capacidadCamas = 0;

            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        if (el.nombre && (
                            el.nombre.toLowerCase().includes('cama') ||
                            el.nombre.toLowerCase().includes('bed') ||
                            el.nombre.toLowerCase().includes('litera') ||
                            el.nombre.toLowerCase().includes('camarote')
                        )) {
                            totalCamas++;
                            capacidadCamas += (el.capacity || 0) * (el.cantidad || 1);
                        }
                    });
                }
            });

            console.log(`   Camas identificadas: ${totalCamas}`);
            console.log(`   Capacidad de camas: ${capacidadCamas} personas`);

            if (updated.capacidad === 6) {
                console.log('\n🎉 ¡CABAÑA 7 REPARADA!');
                console.log('   Capacidad: 6 personas ✓');
            } else {
                console.log(`\n⚠️  Capacidad: ${updated.capacidad} (esperado: 6)`);
            }
        }

    } catch (error) {
        console.error('❌ Error durante la reparación:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar
repararCabana7().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Reparación completada');
    console.log('\n💡 Verifica con: node check-cabana7.js');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});