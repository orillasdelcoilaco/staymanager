#!/usr/bin/env node
/**
 * Diagnóstico del problema de capacidad de Cabaña 7
 *
 * Problema reportado: Cabaña 7 muestra capacidad 12 cuando debería ser 6
 * Se revisaron los activos y estaban bien configurados
 * Se eliminaron duplicados en los activos
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
try {
    const serviceAccount = require(path.join(__dirname, '..', 'backend', 'serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error('Error inicializando Firebase:', error.message);
    process.exit(1);
}

const db = admin.firestore();

async function diagnosticarCabaña7() {
    console.log('🔍 DIAGNÓSTICO DE CAPACIDAD - CABAÑA 7');
    console.log('=' .repeat(60));

    try {
        // 1. Buscar Cabaña 7 por nombre
        const propiedadesRef = db.collectionGroup('propiedades');
        const snapshot = await propiedadesRef
            .where('nombre', '==', 'Cabaña 7')
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log('❌ No se encontró Cabaña 7');
            return;
        }

        const propiedadDoc = snapshot.docs[0];
        const propiedadData = propiedadDoc.data();
        const propiedadId = propiedadDoc.id;
        const empresaId = propiedadDoc.ref.parent.parent.id;

        console.log(`📋 Propiedad encontrada: ${propiedadData.nombre}`);
        console.log(`📊 Capacidad actual: ${propiedadData.capacidad || 'No definida'}`);
        console.log(`📊 Capacidad calculada: ${propiedadData.calculated_capacity || 'No calculada'}`);
        console.log(`🏢 Empresa ID: ${empresaId}`);
        console.log(`🔑 Propiedad ID: ${propiedadId}`);

        // 2. Obtener componentes de la propiedad
        const componentesSnapshot = await db
            .collection('empresas')
            .doc(empresaId)
            .collection('propiedades')
            .doc(propiedadId)
            .collection('componentes')
            .get();

        console.log(`\n📦 COMPONENTES (${componentesSnapshot.size} encontrados):`);
        console.log('-' .repeat(40));

        let capacidadTotalBackend = 0;
        let capacidadTotalFrontend = 0;
        const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

        const componentes = [];
        componentesSnapshot.forEach(doc => {
            const comp = doc.data();
            componentes.push(comp);

            console.log(`\n🔹 ${comp.nombre || 'Sin nombre'} (${comp.tipo || 'Sin tipo'})`);

            if (comp.elementos && Array.isArray(comp.elementos)) {
                console.log(`   Elementos (${comp.elementos.length}):`);
                comp.elementos.forEach((elem, idx) => {
                    console.log(`   ${idx + 1}. ${elem.nombre || 'Sin nombre'} x${elem.cantidad || 1}`);
                    console.log(`      capacity: ${elem.capacity || 'No definido'}`);
                    console.log(`      tipoId: ${elem.tipoId || 'No definido'}`);

                    // Calcular capacidad manualmente
                    if (elem.capacity) {
                        const cap = Number(elem.capacity) * (elem.cantidad || 1);
                        console.log(`      → Capacidad: ${cap} (${elem.capacity} x ${elem.cantidad || 1})`);
                    }
                });
            }
        });

        // 3. Calcular capacidad con función backend
        capacidadTotalBackend = calcularCapacidad(componentes);
        console.log(`\n📊 CÁLCULO BACKEND (propiedadLogicService.js):`);
        console.log(`   Resultado: ${capacidadTotalBackend}`);

        // 4. Calcular capacidad con lógica frontend simulada
        console.log(`\n📊 CÁLCULO FRONTEND (alojamientos.modals.helpers.js):`);

        // Simular la función del frontend
        function calcularCapacidadElementosFrontend(elementos) {
            let capacidad = 0;
            if (!Array.isArray(elementos)) return capacidad;

            function normalizarStr(str) {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }

            elementos.forEach(elem => {
                const nombreElem = normalizarStr((elem.nombre || '').toUpperCase());
                const cantidad = parseInt(elem.cantidad) || 1;

                if (Number(elem.capacity) > 0) {
                    capacidad += Number(elem.capacity) * cantidad;
                    return;
                }

                const esDoble = nombreElem.includes('KING') || nombreElem.includes('QUEEN') ||
                    nombreElem.includes('MATRIMONIAL') || nombreElem.includes('DOBLE') ||
                    nombreElem.includes('2 PLAZAS') || nombreElem.includes('DOS PLAZAS');

                const esSimple = nombreElem.includes('1 PLAZA') || nombreElem.includes('1.5 PLAZA') ||
                    nombreElem.includes('INDIVIDUAL') || nombreElem.includes('SINGLE') ||
                    nombreElem.includes('NIDO') || nombreElem.includes('CATRE') || nombreElem.includes('SIMPLE');

                const esCama = nombreElem.includes('CAMA') || nombreElem.includes('BED');
                const esLitera = nombreElem.includes('LITERA') || nombreElem.includes('CAMAROTE');
                const esSofa = nombreElem.includes('SOFA CAMA') || nombreElem.includes('FUTON') || nombreElem.includes('SOFABED');
                const esColchon = nombreElem.includes('COLCHON') || nombreElem.includes('INFLABLE');

                if (esLitera) {
                    capacidad += 2 * cantidad;
                } else if (esDoble) {
                    capacidad += 2 * cantidad;
                } else if (esSimple) {
                    capacidad += 1 * cantidad;
                } else if (esSofa || esColchon) {
                    capacidad += 1 * cantidad;
                } else if (esCama) {
                    capacidad += 1 * cantidad;
                }
            });

            return capacidad;
        }

        componentes.forEach(comp => {
            if (comp.elementos && Array.isArray(comp.elementos)) {
                capacidadTotalFrontend += calcularCapacidadElementosFrontend(comp.elementos);
            }
        });

        console.log(`   Resultado: ${capacidadTotalFrontend}`);

        // 5. Verificar tipos de elemento (activos)
        console.log(`\n🔍 VERIFICANDO TIPOS DE ELEMENTO (ACTIVOS):`);

        // Obtener todos los tipos de elemento de la empresa
        const tiposElementoSnapshot = await db
            .collection('empresas')
            .doc(empresaId)
            .collection('tiposElemento')
            .get();

        console.log(`   Total tipos de elemento: ${tiposElementoSnapshot.size}`);

        // Crear mapa de tipos de elemento por ID
        const tiposElementoMap = new Map();
        tiposElementoSnapshot.forEach(doc => {
            const tipo = doc.data();
            tiposElementoMap.set(doc.id, tipo);
        });

        // Verificar cada elemento en los componentes
        let elementosConProblemas = [];
        componentes.forEach(comp => {
            if (comp.elementos && Array.isArray(comp.elementos)) {
                comp.elementos.forEach(elem => {
                    if (elem.tipoId && tiposElementoMap.has(elem.tipoId)) {
                        const tipoElemento = tiposElementoMap.get(elem.tipoId);
                        console.log(`\n   🔸 ${elem.nombre || 'Sin nombre'}:`);
                        console.log(`      Tipo ID: ${elem.tipoId}`);
                        console.log(`      Nombre tipo: ${tipoElemento.nombre}`);
                        console.log(`      Capacity en tipo: ${tipoElemento.capacity || 'No definido'}`);
                        console.log(`      Capacity en elemento: ${elem.capacity || 'No definido'}`);

                        // Verificar inconsistencia
                        if (tipoElemento.capacity && elem.capacity && tipoElemento.capacity !== elem.capacity) {
                            console.log(`      ⚠️  INCONSISTENCIA: Tipo tiene ${tipoElemento.capacity}, elemento tiene ${elem.capacity}`);
                            elementosConProblemas.push({
                                elemento: elem.nombre,
                                tipo: tipoElemento.nombre,
                                capacityTipo: tipoElemento.capacity,
                                capacityElemento: elem.capacity
                            });
                        }
                    } else if (elem.tipoId) {
                        console.log(`\n   🔸 ${elem.nombre || 'Sin nombre'}:`);
                        console.log(`      ⚠️  Tipo ID ${elem.tipoId} NO ENCONTRADO en tiposElemento`);
                    }
                });
            }
        });

        // 6. Análisis de resultados
        console.log(`\n📈 ANÁLISIS DE RESULTADOS:`);
        console.log('=' .repeat(40));
        console.log(`Capacidad en BD: ${propiedadData.capacidad || 'No definida'}`);
        console.log(`Calculated_capacity en BD: ${propiedadData.calculated_capacity || 'No calculada'}`);
        console.log(`Cálculo backend: ${capacidadTotalBackend}`);
        console.log(`Cálculo frontend: ${capacidadTotalFrontend}`);

        if (capacidadTotalBackend !== capacidadTotalFrontend) {
            console.log(`\n⚠️  DISCREPANCIA: Backend y frontend calculan valores diferentes`);
            console.log(`   Diferencia: ${Math.abs(capacidadTotalBackend - capacidadTotalFrontend)}`);
        }

        if (elementosConProblemas.length > 0) {
            console.log(`\n🔴 PROBLEMAS ENCONTRADOS:`);
            elementosConProblemas.forEach(prob => {
                console.log(`   - ${prob.elemento} (tipo: ${prob.tipo}):`);
                console.log(`     Tipo tiene capacity=${prob.capacityTipo}, elemento tiene capacity=${prob.capacityElemento}`);
            });
        }

        // 7. Recomendaciones
        console.log(`\n💡 RECOMENDACIONES:`);
        console.log('=' .repeat(40));

        if (capacidadTotalBackend === 12 && capacidadTotalFrontend === 6) {
            console.log(`1. El backend está calculando el DOBLE del frontend`);
            console.log(`2. Posible causa: Lógica de fallback duplicada`);
            console.log(`3. Solución: Revisar función calcularCapacidad en propiedadLogicService.js`);
            console.log(`   - Verificar líneas 24-37 (lógica de fallback)`);
            console.log(`   - Puede estar sumando capacity + fallback`);
        } else if (capacidadTotalBackend === 6 && capacidadTotalFrontend === 12) {
            console.log(`1. El frontend está calculando el DOBLE del backend`);
            console.log(`2. Posible causa: Lógica de fallback en frontend`);
            console.log(`3. Solución: Revisar calcularCapacidadElementos en alojamientos.modals.helpers.js`);
        } else {
            console.log(`1. Los cálculos son diferentes pero no el doble`);
            console.log(`2. Revisar cada elemento individualmente`);
            console.log(`3. Verificar valores de 'capacity' en elementos vs tiposElemento`);
        }

        console.log(`\n4. Verificar duplicados en elementos (línea 257-258 de propiedadesService.js)`);
        console.log(`5. Asegurar que 'capacity' esté definido en cada elemento de cama`);

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    } finally {
        console.log('\n' + '=' .repeat(60));
        console.log('🔚 Diagnóstico completado');
    }
}

// Ejecutar diagnóstico
diagnosticarCabaña7().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});