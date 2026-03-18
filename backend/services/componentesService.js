// backend/services/componentesService.js
const admin = require('firebase-admin');
const { generateWithFallback } = require('./aiContentService');

const obtenerTiposPorEmpresa = async (db, empresaId) => {
    console.log(`[Service] Consultando tipos para empresa: ${empresaId}`);
    const snapshot = await db.collection('empresas').doc(empresaId)
        .collection('tiposComponente')
        .get();

    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const analizarNuevoTipoConIA = async (nombreUsuario) => {
    const prompt = `
        Actúa como Arquitecto de Hospitalidad. Analiza el espacio de alojamiento: "${nombreUsuario}".

        REGLAS DE NOMBRE:
        1. Si es "Dormitorio", MANTÉN "Dormitorio". NO inventes "Principal" ni "Recámara" a menos que lo diga el input.
        2. Si dice "Suite" o "En Suite", MANTÉN "Suite" (es crítico para el conteo de baños).
        3. Mantén el nombre fiel al input del usuario, solo corrigiendo ortografía o capitalización.

        CATEGORÍAS DE ESPACIO VÁLIDAS (usar EXACTAMENTE una de estas):
        "Dormitorio" | "Baño" | "Living" | "Cocina" | "Comedor" | "Terraza" | "Exterior" | "Área Común" | "Servicio" | "Otros"

        REGLAS DE FORMATO:
        1. "categoria": elige la categoría de espacio que mejor corresponda de la lista de arriba.
        2. Nombres de Elementos: Usa Title Case (ej: "Cama King", no "cama king").
        3. "shotList": instrucciones claras para el fotógrafo, orientadas a Airbnb y Google Hotels.
        4. "inventarioSugerido": elementos TÍPICOS de este espacio, con cantidades reales. Sé específico.
        5. "palabrasClave": términos de búsqueda que usan huéspedes en español.
        6. "seo_description": frase de 1-2 oraciones para usar en la descripción web del espacio.

        Responde SOLO con JSON válido (sin markdown):
        {
            "nombreNormalizado": "Nombre singular correcto (ej: Dormitorio, no Dormitorios)",
            "categoria": "Una de las categorías válidas listadas arriba",
            "icono": "Emoji representativo del espacio",
            "descripcionBase": "Definición breve del espacio (1 oración)",
            "seo_description": "Descripción web optimizada del espacio (1-2 oraciones para huéspedes)",
            "shotList": [
                "Foto panorámica desde la entrada",
                "Detalle de [elemento principal]",
                "Ángulo mostrando [característica destacada]"
            ],
            "inventarioSugerido": [
                { "nombre": "Nombre Elemento", "cantidad": 1, "categoria": "Categoría" }
            ],
            "palabrasClave": ["keyword1", "keyword2", "keyword3"]
        }
    `;

    try {
        console.log(`[Componentes IA] Analizando espacio: "${nombreUsuario}"...`);
        const result = await generateWithFallback(prompt);
        if (!result) throw new Error('No result from any AI provider');
        return result;
    } catch (error) {
        // Propagar errores de cuota para que el frontend lo sepa
        if (error.code === 'AI_QUOTA_EXCEEDED') throw error;

        console.error('[Componentes IA] Error en análisis, usando defaults:', error.message);
        // Fallback heurístico de categoría
        const nom = nombreUsuario.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const catFallback = /dorm|hab|pieza|cuarto|suite/.test(nom) ? 'Dormitorio'
            : /ban|wc|aseo/.test(nom) ? 'Baño'
            : /cocin/.test(nom) ? 'Cocina'
            : /comedor|dining/.test(nom) ? 'Comedor'
            : /living|sala|estar/.test(nom) ? 'Living'
            : /terraz|patio|balcon|jardin|outdoor|exterior/.test(nom) ? 'Terraza'
            : 'Otros';
        return {
            nombreNormalizado: nombreUsuario,
            categoria: catFallback,
            icono: '🏠',
            descripcionBase: 'Espacio del alojamiento.',
            seo_description: `${nombreUsuario} equipado para brindar comodidad a los huéspedes.`,
            shotList: ['Foto general del espacio', 'Detalle del equipamiento principal'],
            inventarioSugerido: [],
            palabrasClave: [nombreUsuario.toLowerCase()]
        };
    }
};

const crearTipoComponente = async (db, empresaId, datos) => {
    const ref = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc();
    const nuevoTipo = {
        id: ref.id,
        nombreUsuario: datos.nombreUsuario || datos.nombreNormalizado,
        nombreNormalizado: datos.nombreNormalizado,
        categoria: datos.categoria || 'Otros',
        icono: datos.icono || '📦',
        descripcionBase: datos.descripcionBase || '',
        shotList: datos.shotList || [],
        palabrasClave: datos.palabrasClave || [],
        origen: datos.origen || 'personalizado',
        elementosDefault: datos.elementosDefault || [],
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(nuevoTipo);
    return nuevoTipo;
};

const eliminarTipoComponente = async (db, empresaId, tipoId) => {
    // 1. Obtener el tipo antes de borrar para saber su nombre
    const typeRef = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc(tipoId);
    const typeDoc = await typeRef.get();

    if (!typeDoc.exists) {
        throw new Error("El tipo de componente no existe.");
    }

    const typeData = typeDoc.data();
    const typeName = (typeData.nombreNormalizado || '').toUpperCase().trim();
    const typeUser = (typeData.nombreUsuario || '').toUpperCase().trim();

    // 2. Verificar si alguna propiedad lo está usando
    // Nota: Esto puede ser costoso si hay miles de propiedades, pero necesario para consistencia.
    // Una optimización futura sería mantener un contador de uso en el tipoComponente.
    const propsSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').get();

    let usoEncontrado = null;

    propsSnapshot.forEach(doc => {
        if (usoEncontrado) return; // Ya encontramos uno, salir (optimización leve)

        const prop = doc.data();
        if (prop.componentes && Array.isArray(prop.componentes)) {
            const match = prop.componentes.find(comp => {
                const compTipo = (comp.tipo || '').toUpperCase().trim();
                return compTipo === typeName || compTipo === typeUser;
            });

            if (match) {
                usoEncontrado = prop.nombre;
            }
        }
    });

    if (usoEncontrado) {
        throw new Error(`No se puede eliminar: El tipo '${typeData.nombreUsuario}' está en uso en la propiedad '${usoEncontrado}'. Borra las referencias primero.`);
    }

    // 3. Si no está en uso, proceder a borrar
    await typeRef.delete();
};

const actualizarTipoComponente = async (db, empresaId, tipoId, datos) => {
    const ref = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc(tipoId);

    // Validar que exista
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Tipo de componente no encontrado.');

    // Construir objeto de actualización
    const updateData = {
        nombreUsuario: datos.nombreUsuario || datos.nombreNormalizado,
        nombreNormalizado: datos.nombreNormalizado,
        icono: datos.icono,
        descripcionBase: datos.descripcionBase,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    if (datos.shotList) updateData.shotList = datos.shotList;
    if (datos.inventarioSugerido) updateData.inventarioSugerido = datos.inventarioSugerido;
    if (datos.elementosDefault) updateData.elementosDefault = datos.elementosDefault;
    if (datos.origen) updateData.origen = datos.origen;

    await ref.update(updateData);
    return { id: tipoId, ...updateData };
};

module.exports = {
    obtenerTiposPorEmpresa,
    analizarNuevoTipoConIA,
    crearTipoComponente,
    eliminarTipoComponente,
    actualizarTipoComponente
};