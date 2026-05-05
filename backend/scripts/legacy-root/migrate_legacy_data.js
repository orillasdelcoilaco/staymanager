const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const REQUIRED_TYPES = [
    { nombre: 'Cama Matrimonial', categoria: 'CAMA', icono: '🛏️', countable: true, count_value_default: 2 },
    { nombre: 'Cama Plaza y Media', categoria: 'CAMA', icono: '🛏️', countable: true, count_value_default: 1 },
    { nombre: 'Camarote', categoria: 'CAMA', icono: '🪜', countable: true, count_value_default: 2 },
    { nombre: 'Parrilla', categoria: 'EQUIPAMIENTO', icono: '🍖', countable: false },
    { nombre: 'Terraza Techada', categoria: 'EQUIPAMIENTO', icono: '☂️', countable: false },
    { nombre: 'Juego de Terraza', categoria: 'EQUIPAMIENTO', icono: '🪑', countable: false },
    { nombre: 'Tinaja', categoria: 'EQUIPAMIENTO', icono: '🛁', countable: false },
    { nombre: 'TV', categoria: 'EQUIPAMIENTO', icono: '📺', countable: false },
    { nombre: 'Wifi', categoria: 'EQUIPAMIENTO', icono: '📶', countable: false },
    { nombre: 'Estacionamiento', categoria: 'EQUIPAMIENTO', icono: '🚗', countable: false },
    { nombre: 'Cocina Equipada', categoria: 'EQUIPAMIENTO', icono: '🍳', countable: false }
];

async function ensureTypes(empresaId) {
    const typesRef = db.collection('empresas').doc(empresaId).collection('tiposElemento');
    const snapshot = await typesRef.get();
    const existingTypes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const typeMap = {};

    for (const reqType of REQUIRED_TYPES) {
        let match = existingTypes.find(t => t.nombre === reqType.nombre);
        if (!match) {
            console.log(`Creating type: ${reqType.nombre} for empresa ${empresaId}`);
            const id = uuidv4();
            const newType = {
                ...reqType,
                permiteCantidad: true,
                photo_requirements_default: [],
                fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
            };
            await typesRef.doc(id).set(newType);
            typeMap[reqType.nombre] = { id, ...newType };
        } else {
            typeMap[reqType.nombre] = match;
        }
    }
    return typeMap;
}

async function migrate() {
    try {
        const empresasSnapshot = await db.collection('empresas').get();
        if (empresasSnapshot.empty) return;

        for (const empresaDoc of empresasSnapshot.docs) {
            console.log(`\nProcessing Empresa: ${empresaDoc.id}`);
            const typeMap = await ensureTypes(empresaDoc.id);
            const propiedadesSnapshot = await empresaDoc.ref.collection('propiedades').get();

            for (const propDoc of propiedadesSnapshot.docs) {
                const data = propDoc.data();
                if (data.componentes && data.componentes.length > 0) {
                    console.log(`Skipping ${data.nombre} (already has components)`);
                    continue;
                }

                console.log(`Migrating ${data.nombre}...`);
                const componentes = [];

                // --- CAMAS ---
                const camas = data.camas || {};

                // Dormitorio Principal
                if (camas.matrimoniales > 0) {
                    const compId = uuidv4();
                    const elementos = [];
                    // Add Matrimoniales
                    for (let i = 0; i < camas.matrimoniales; i++) {
                        elementos.push({
                            tipoId: typeMap['Cama Matrimonial'].id,
                            nombre: 'Cama Matrimonial',
                            icono: '🛏️',
                            categoria: 'CAMA',
                            cantidad: 1,
                            permiteCantidad: true,
                            amenity: i === 0 ? 'Principal' : ''
                        });
                    }

                    componentes.push({
                        id: compId,
                        nombre: 'Dormitorio Principal',
                        tipo: 'DORMITORIO',
                        icono: '🛏️',
                        elementos
                    });
                }

                // Otros Dormitorios (Camarotes y Plaza y Media)
                if (camas.camarotes > 0 || camas.plazaYMedia > 0) {
                    const compId = uuidv4();
                    const elementos = [];

                    if (camas.camarotes > 0) {
                        elementos.push({
                            tipoId: typeMap['Camarote'].id,
                            nombre: 'Camarote',
                            icono: '🪜',
                            categoria: 'CAMA',
                            cantidad: camas.camarotes,
                            permiteCantidad: true,
                            amenity: ''
                        });
                    }
                    if (camas.plazaYMedia > 0) {
                        elementos.push({
                            tipoId: typeMap['Cama Plaza y Media'].id,
                            nombre: 'Cama Plaza y Media',
                            icono: '🛏️',
                            categoria: 'CAMA',
                            cantidad: camas.plazaYMedia,
                            permiteCantidad: true,
                            amenity: ''
                        });
                    }

                    componentes.push({
                        id: compId,
                        nombre: 'Dormitorio Secundario',
                        tipo: 'DORMITORIO',
                        icono: '🛏️',
                        elementos
                    });
                }

                // --- EQUIPAMIENTO ---
                const equip = data.equipamiento || {};

                // Terraza
                if (equip.parrilla || equip.terrazaTechada || equip.juegoDeTerraza || equip.tinaja) {
                    const compId = uuidv4();
                    const elementos = [];
                    if (equip.parrilla) elementos.push({ tipoId: typeMap['Parrilla'].id, nombre: 'Parrilla', icono: '🍖', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true });
                    if (equip.terrazaTechada) elementos.push({ tipoId: typeMap['Terraza Techada'].id, nombre: 'Terraza Techada', icono: '☂️', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true });
                    if (equip.juegoDeTerraza) elementos.push({ tipoId: typeMap['Juego de Terraza'].id, nombre: 'Juego de Terraza', icono: '🪑', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true });
                    if (equip.tinaja) elementos.push({ tipoId: typeMap['Tinaja'].id, nombre: 'Tinaja', icono: '🛁', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true });

                    componentes.push({
                        id: compId,
                        nombre: 'Terraza',
                        tipo: 'TERRAZA',
                        icono: '☀️',
                        elementos
                    });
                }

                // Living / General
                const livingElements = [];
                if (equip.tv) livingElements.push({ tipoId: typeMap['TV'].id, nombre: 'TV', icono: '📺', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true });
                if (equip.wifi) livingElements.push({ tipoId: typeMap['Wifi'].id, nombre: 'Wifi', icono: '📶', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true });

                if (livingElements.length > 0) {
                    const compId = uuidv4();
                    componentes.push({
                        id: compId,
                        nombre: 'Living / General',
                        tipo: 'LIVING',
                        icono: '🛋️',
                        elementos: livingElements
                    });
                }

                // Estacionamiento
                if (equip.estacionamiento) {
                    const compId = uuidv4();
                    componentes.push({
                        id: compId,
                        nombre: 'Exterior',
                        tipo: 'EXTERIOR',
                        icono: '🌳',
                        elementos: [{ tipoId: typeMap['Estacionamiento'].id, nombre: 'Estacionamiento', icono: '🚗', categoria: 'EQUIPAMIENTO', cantidad: 1, permiteCantidad: true }]
                    });
                }

                // Update Propiedad
                await propDoc.ref.update({
                    componentes: componentes,
                    migrationStatus: 'migrated_v2',
                    fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Migrated ${data.nombre} successfully.`);
            }
        }
        console.log('\nMigration complete.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrate();
