/**
 * empresaImporterService.steps.js
 *
 * Funciones de pasos del orquestador del importador de empresas.
 * Exportadas para uso exclusivo de empresaImporterService.js.
 */

const { register } = require('./authService');
const { crearTipo: crearTipoElemento, obtenerTipos } = require('./tiposElementoService');
const { crearTipoComponente, analizarNuevoTipoConIA, obtenerTiposPorEmpresa } = require('./componentesService');
const { crearPropiedad, actualizarPropiedad, obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { crearCanal, obtenerCanalesPorEmpresa } = require('./canalesService');
const { analizarMetadataActivo } = require('./aiContentService');
const { crearTipoPlantilla, crearPlantilla, obtenerTiposPlantilla, obtenerPlantillasPorEmpresa } = require('./plantillasService');
const { obtenerMapeoCentralPorNombre, aplicarMapeoCentralAEmpresa } = require('./mapeosCentralesService');
const {
    normalizeKey,
    singularKey,
    buildComponentes,
    distribuirImagenesPorComponente,
    buildClasificacionMap,
    importarGaleriaPropiedad,
} = require('./empresaImporterService.helpers');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────
// PASOS DEL ORQUESTADOR
// ─────────────────────────────────────────────

/**
 * Paso 1: Resolver empresa (buscar existente o crear nueva).
 * Retorna { empresaId, uid, modo }.
 */
async function _resolverEmpresa(adminSdk, db, empresa, email, password, wizardAnswers, findEmpresaByEmail, resetEmpresaData) {
    const existing = await findEmpresaByEmail(adminSdk, db, email);

    if (existing) {
        const { empresaId, uid } = existing;
        console.log(`[Importer] ♻️  Empresa existente encontrada: ${empresaId} → modo ACTUALIZACIÓN`);
        if (wizardAnswers.resetMode === true) {
            console.log(`[Importer] ⚠️  resetMode=true → borrando datos antes de reimportar...`);
            await resetEmpresaData(db, empresaId);
        }
        return { empresaId, uid, modo: 'actualización' };
    }

    console.log(`[Importer] 🆕 Creando nueva empresa: "${empresa.nombre}"`);
    try {
        const regResult = await register(adminSdk, db, { nombreEmpresa: empresa.nombre, email, password });
        console.log(`[Importer] ✅ Empresa creada: ${regResult.empresaId}`);
        return { empresaId: regResult.empresaId, uid: regResult.uid, modo: 'creación' };
    } catch (err) {
        console.error(`[Importer] ❌ Error en registro:`, err.message);
        throw new Error(`No se pudo crear la empresa: ${err.message}`);
    }
}

/**
 * Paso 2: Actualizar info base de la empresa (nombre, slogan, historia…).
 */
async function _actualizarInfoEmpresa(db, empresaId, empresa) {
    const empresaRef = db.collection('empresas').doc(empresaId);
    const empresaUpdate = {};
    if (empresa.nombre)    empresaUpdate.nombre = empresa.nombre;
    if (empresa.slogan)    empresaUpdate.slogan = empresa.slogan;
    if (empresa.historia)  empresaUpdate.historiaEmpresa = empresa.historia;
    if (empresa.sitioWeb)  empresaUpdate.sitioWeb = empresa.sitioWeb;
    if (empresa.email)     empresaUpdate.emailContacto = empresa.email;
    if (empresa.telefono)  empresaUpdate.telefono = empresa.telefono;
    if (empresa.direccion) empresaUpdate.direccion = empresa.direccion;
    if (empresa.ciudad)    empresaUpdate.ciudad = empresa.ciudad;
    if (Object.keys(empresaUpdate).length > 0) {
        await empresaRef.set(empresaUpdate, { merge: true });
        console.log(`[Importer] ✅ Info empresa actualizada`);
    }
}

/**
 * Paso 3: Sincronizar canales (Venta Directa + OTA adicionales).
 * Retorna canalDirectoId.
 */
async function _sincronizarCanales(db, empresaId, moneda, wizardAnswers, result) {
    console.log(`[Importer] 3️⃣  Verificando canal Venta Directa...`);
    let canalDirectoId;

    try {
        const canalesExistentes = await obtenerCanalesPorEmpresa(db, empresaId);
        const canalVD = canalesExistentes.find(c =>
            normalizeKey(c.nombre).includes('venta directa') || c.esCanalPorDefecto
        );

        if (canalVD) {
            canalDirectoId = canalVD.id;
            result.omitidos.push(`Canal "${canalVD.nombre}" (ya existe)`);
            console.log(`[Importer] ⏭️  Canal Venta Directa ya existe: ${canalDirectoId}`);
        } else {
            const canal = await crearCanal(db, empresaId, {
                nombre: 'Venta Directa',
                descripcion: 'Canal de reservas directas (sitio web propio)',
                moneda,
                esCanalPorDefecto: true,
                esCanalIcal: false,
                modificadorTipo: null,
                modificadorValor: 0
            });
            canalDirectoId = canal.id;
            result.canales.push(canal);
            console.log(`[Importer] ✅ Canal creado: ${canalDirectoId}`);
        }
    } catch (err) {
        result.errores.push(`Canal Venta Directa: ${err.message}`);
        canalDirectoId = null;
    }

    const canalesActuales = await obtenerCanalesPorEmpresa(db, empresaId);
    const nombresExistentes = new Set(canalesActuales.map(c => normalizeKey(c.nombre)));

    for (const nombreCanal of (wizardAnswers.canalesOTA || [])) {
        if (nombresExistentes.has(normalizeKey(nombreCanal))) {
            result.omitidos.push(`Canal "${nombreCanal}" (ya existe)`);
            continue;
        }
        try {
            const canal = await crearCanal(db, empresaId, { nombre: nombreCanal, moneda, esCanalPorDefecto: false });
            result.canales.push(canal);
            try {
                const mapeoCentral = await obtenerMapeoCentralPorNombre(db, nombreCanal);
                if (mapeoCentral) {
                    await aplicarMapeoCentralAEmpresa(db, empresaId, canal.id, mapeoCentral);
                    console.log(`[Importer]   ✅ Mapeo central aplicado a: ${nombreCanal}`);
                }
            } catch (e) { console.warn(`[Importer]   ⚠️ Sin mapeo central para: ${nombreCanal}`); }
            console.log(`[Importer] ✅ Canal OTA: ${nombreCanal}`);
            await sleep(200);
        } catch (err) {
            result.errores.push(`Canal ${nombreCanal}: ${err.message}`);
        }
    }

    return canalDirectoId;
}

/**
 * Paso 4: Sincronizar tipos de activo/elemento (upsert por nombre).
 * Retorna tiposElemMap.
 */
async function _sincronizarTiposElemento(db, empresaId, tiposActivo, result) {
    console.log(`[Importer] 4️⃣  Sincronizando ${tiposActivo.length} tipos de activo...`);

    const tiposElemExistentes = await obtenerTipos(db, empresaId);
    const tiposElemMap = new Map();
    for (const te of tiposElemExistentes) {
        tiposElemMap.set(normalizeKey(te.nombre), te);
    }

    const categoriasExistentes = [...new Set([
        ...tiposElemExistentes.map(t => t.categoria),
        ...tiposActivo.map(a => a.categoria)
    ].filter(Boolean))];

    for (const activo of tiposActivo) {
        const key = normalizeKey(activo.nombre);
        if (tiposElemMap.has(key)) {
            result.omitidos.push(`Activo "${activo.nombre}" (ya existe)`);
            continue;
        }
        try {
            await sleep(300);
            const metadata = await analizarMetadataActivo(activo.nombre, categoriasExistentes);
            const nuevoTipo = await crearTipoElemento(db, empresaId, {
                nombre: metadata.normalized_name || activo.nombre,
                categoria: metadata.category || activo.categoria || 'Equipamiento',
                icono: metadata.icon || '🔹',
                countable: metadata.countable || false,
                capacity: metadata.capacity || 0,
                requires_photo: metadata.requires_photo || false,
                photo_quantity: metadata.photo_quantity || 0,
                photo_guidelines: metadata.photo_guidelines || null,
                seo_tags: metadata.seo_tags || [],
                sales_context: metadata.sales_context || null,
                schema_type: metadata.schema_type || 'Thing',
                schema_property: metadata.schema_property || null
            });
            tiposElemMap.set(normalizeKey(nuevoTipo.nombre), nuevoTipo);
            tiposElemMap.set(key, nuevoTipo);
            result.tiposElemento.push(nuevoTipo);
            console.log(`[Importer]   ✅ Activo nuevo: "${nuevoTipo.nombre}"`);
        } catch (err) {
            result.errores.push(`TipoElemento "${activo.nombre}": ${err.message}`);
        }
    }

    return tiposElemMap;
}

/**
 * Paso 5: Sincronizar tipos de espacio/componente (upsert por nombreNormalizado).
 * Retorna tiposCompMap.
 */
async function _sincronizarTiposComponente(db, empresaId, tiposEspacio, result) {
    console.log(`[Importer] 5️⃣  Sincronizando ${tiposEspacio.length} tipos de espacio...`);

    const tiposCompExistentes = await obtenerTiposPorEmpresa(db, empresaId);
    const tiposCompMap = new Map();
    const CATEGORIAS_VALIDAS = new Set(['Dormitorio', 'Baño', 'Living', 'Cocina', 'Comedor', 'Terraza', 'Exterior', 'Área Común', 'Servicio', 'Otros']);

    for (const tc of tiposCompExistentes) {
        const keys = [
            normalizeKey(tc.nombreNormalizado || ''),
            normalizeKey(tc.nombreUsuario || ''),
            singularKey(tc.nombreNormalizado || ''),
            singularKey(tc.nombreUsuario || '')
        ];
        keys.filter(Boolean).forEach(k => tiposCompMap.set(k, tc));
    }

    for (const espacioNombre of tiposEspacio) {
        const key = normalizeKey(espacioNombre);
        const keyS = singularKey(espacioNombre);
        if (tiposCompMap.has(key) || tiposCompMap.has(keyS)) {
            result.omitidos.push(`Espacio "${espacioNombre}" (ya existe)`);
            continue;
        }
        try {
            await sleep(400);
            const aiData = await analizarNuevoTipoConIA(espacioNombre);
            const categoriaIA = aiData.categoria;
            const categoriaFinal = CATEGORIAS_VALIDAS.has(categoriaIA) ? categoriaIA : 'Otros';
            if (!CATEGORIAS_VALIDAS.has(categoriaIA)) {
                console.warn(`[Importer] ⚠️  Categoría inválida de IA: "${categoriaIA}" para "${espacioNombre}" → forzado a "Otros"`);
            }
            const nuevoTipo = await crearTipoComponente(db, empresaId, {
                nombreUsuario: espacioNombre,
                nombreNormalizado: aiData.nombreNormalizado || espacioNombre,
                categoria: categoriaFinal,
                icono: aiData.icono || '🏠',
                descripcionBase: aiData.descripcionBase || '',
                shotList: aiData.shotList || [],
                palabrasClave: aiData.palabrasClave || [],
                origen: 'importado',
                elementosDefault: aiData.inventarioSugerido || []
            });
            [key, keyS, normalizeKey(aiData.nombreNormalizado || ''), singularKey(aiData.nombreNormalizado || '')]
                .filter(Boolean).forEach(k => tiposCompMap.set(k, nuevoTipo));
            result.tiposComponente.push(nuevoTipo);
            console.log(`[Importer]   ✅ Espacio nuevo: "${nuevoTipo.nombreNormalizado}" → ${nuevoTipo.categoria}`);
        } catch (err) {
            result.errores.push(`TipoComponente "${espacioNombre}": ${err.message}`);
        }
    }

    return tiposCompMap;
}

/**
 * Actualiza una propiedad existente con descripción y fotos si le faltan.
 */
async function _actualizarPropiedadExistente(db, empresaId, existente, aloj, canalDirectoId, moneda, importData, result, upsertTarifa) {
    const updateData = {};
    if (aloj.descripcionVisual || aloj.descripcion) {
        updateData['websiteData.aiDescription'] = aloj.descripcionVisual || aloj.descripcion;
    }

    const sinFotos = !existente.websiteData?.cardImage;
    if (sinFotos && (aloj.imagenesRepresentativas || []).length > 0) {
        const compExistentes = existente.componentes || [];
        const imagenesPorCompEx = distribuirImagenesPorComponente(
            aloj.imagenesRepresentativas, compExistentes, 3, aloj.imagenesClasificadas || []
        );
        const clasificacionMapEx = buildClasificacionMap(imagenesPorCompEx, aloj.imagenesClasificadas || [], compExistentes);
        const { websiteImages: wImgs, cardImage: cImg, totalGaleria } = await importarGaleriaPropiedad(
            aloj.imagenesRepresentativas, clasificacionMapEx,
            db, empresaId, existente.id, aloj, importData.empresa.nombre
        );
        if (totalGaleria > 0) {
            updateData['websiteData.images'] = wImgs;
            updateData['websiteData.cardImage'] = cImg;
            console.log(`[Importer]   ✅ ${totalGaleria} foto(s) en galería para "${aloj.nombre}"`);
        }
    }
    if (aloj.precioBase > 0) updateData.precioBase = aloj.precioBase;
    if (aloj.capacidad > 0)  updateData.capacidadMaxima = aloj.capacidad;

    if (Object.keys(updateData).length > 0) {
        // Construir websiteData fusionado para PostgreSQL
        const websiteDataActual = existente.websiteData || { aiDescription: '', images: {}, cardImage: null };
        const pgUpdate = {};
        if (updateData['websiteData.aiDescription'] !== undefined || updateData['websiteData.images'] || updateData['websiteData.cardImage']) {
            pgUpdate.websiteData = {
                ...websiteDataActual,
                ...(updateData['websiteData.aiDescription'] !== undefined && { aiDescription: updateData['websiteData.aiDescription'] }),
                ...(updateData['websiteData.images']       !== undefined && { images:       updateData['websiteData.images'] }),
                ...(updateData['websiteData.cardImage']    !== undefined && { cardImage:    updateData['websiteData.cardImage'] }),
            };
        }
        if (updateData.precioBase)      pgUpdate.precioBase      = updateData.precioBase;
        if (updateData.capacidadMaxima) pgUpdate.capacidad        = updateData.capacidadMaxima;
        if (Object.keys(pgUpdate).length > 0) {
            await actualizarPropiedad(db, empresaId, existente.id, pgUpdate);
        }
    }
    result.omitidos.push(`Propiedad "${aloj.nombre}" (actualizada descripción)`);
    console.log(`[Importer]   ♻️  Propiedad actualizada: "${aloj.nombre}"`);

    if (aloj.precioBase > 0 && canalDirectoId) {
        await upsertTarifa(db, empresaId, existente.id, aloj.precioBase, moneda, canalDirectoId, result);
    }
}

/**
 * Crea una propiedad nueva con sus componentes, galería y tarifa base.
 */
async function _crearPropiedadNueva(db, empresaId, aloj, tiposCompMap, tiposElemMap, canalDirectoId, moneda, importData, result, upsertTarifa) {
    const componentes = buildComponentes(aloj, tiposCompMap, tiposElemMap);
    console.log(`[Importer] 🔧 "${aloj.nombre}": cap=${aloj.capacidad} dorm=${aloj.numDormitorios} baños=${aloj.numBanos} | componentes=[${componentes.map(c => c.nombreTipo || c.nombre).join(', ')}] | imgs=${aloj.imagenesRepresentativas?.length || 0}`);

    const amenidades = (aloj.amenidades || []).map(a => typeof a === 'string' ? { nombre: a } : a);

    const propiedad = await crearPropiedad(db, empresaId, {
        nombre: aloj.nombre,
        descripcion: aloj.descripcionVisual || aloj.descripcion || '',
        capacidadMaxima: aloj.capacidad || 2,
        numDormitorios: aloj.numDormitorios || 1,
        numBanos: aloj.numBanos || 1,
        metros: aloj.metros || 0,
        moneda,
        componentes,
        amenidades,
        estado: 'activo',
        websiteData: {
            titulo: aloj.nombre,
            descripcion: aloj.descripcionVisual || aloj.descripcion || '',
            aiDescription: aloj.descripcionVisual || aloj.descripcion || '',
            images: {},
            cardImage: null
        }
    });

    const imagenesPorComp = distribuirImagenesPorComponente(
        aloj.imagenesRepresentativas || [], componentes, 3, aloj.imagenesClasificadas || []
    );
    const clasificacionMap = buildClasificacionMap(imagenesPorComp, aloj.imagenesClasificadas || [], componentes);

    const { websiteImages, cardImage, totalGaleria } = await importarGaleriaPropiedad(
        aloj.imagenesRepresentativas || [], clasificacionMap,
        db, empresaId, propiedad.id, aloj, importData.empresa.nombre
    );

    if (totalGaleria > 0) {
        const autoCount = Object.values(websiteImages).flat().length;
        const websiteDataActualizado = {
            ...(propiedad.websiteData || {}),
            images:    websiteImages,
            cardImage: cardImage
        };
        await actualizarPropiedad(db, empresaId, propiedad.id, { websiteData: websiteDataActualizado });
        console.log(`[Importer]   ✅ Galería: ${totalGaleria} fotos subidas (${autoCount} auto-asignadas, ${totalGaleria - autoCount} pendientes) para "${aloj.nombre}"`);
    }

    result.propiedades.push(propiedad);
    console.log(`[Importer]   ✅ Propiedad nueva: "${aloj.nombre}" → ${propiedad.id}`);

    if (aloj.precioBase > 0 && canalDirectoId) {
        await upsertTarifa(db, empresaId, propiedad.id, aloj.precioBase, moneda, canalDirectoId, result);
    }
}

/**
 * Paso 6: Sincronizar propiedades (upsert por nombre).
 */
async function _sincronizarPropiedades(db, empresaId, alojamientos, tiposCompMap, tiposElemMap, canalDirectoId, moneda, importData, result, upsertTarifa) {
    console.log(`[Importer] 6️⃣  Sincronizando ${alojamientos.length} propiedades...`);

    // Leer propiedades existentes desde PostgreSQL (fuente de verdad)
    const propiedadesActuales = await obtenerPropiedadesPorEmpresa(db, empresaId);
    const propExistentes = new Map();
    propiedadesActuales.forEach(p => propExistentes.set(normalizeKey(p.nombre || ''), p));

    for (const aloj of alojamientos) {
        const keyProp = normalizeKey(aloj.nombre);
        const existente = propExistentes.get(keyProp);

        if (existente) {
            await _actualizarPropiedadExistente(db, empresaId, existente, aloj, canalDirectoId, moneda, importData, result, upsertTarifa);
            await sleep(200);
            continue;
        }

        try {
            await _crearPropiedadNueva(db, empresaId, aloj, tiposCompMap, tiposElemMap, canalDirectoId, moneda, importData, result, upsertTarifa);
            await sleep(200);
        } catch (err) {
            result.errores.push(`Propiedad "${aloj.nombre}": ${err.message}`);
            console.error(`[Importer]   ❌ Error propiedad "${aloj.nombre}":`, err.message);
        }
    }
}

const TIPOS_PLANTILLA_DEFAULT = [
    { nombre: 'Propuesta', descripcion: 'Cotizaciones y propuestas de reserva' },
    { nombre: 'Presupuesto', descripcion: 'Presupuestos informativos sin reserva' },
    { nombre: 'Mensaje de Reserva', descripcion: 'Confirmaciones y seguimiento de reservas' },
    { nombre: 'Mensaje de Salida', descripcion: 'Mensajes post-estadía y agradecimiento' },
];

const PLANTILLAS_TEXTO_DEFAULT = {
    'propuesta': {
        nombre: 'Propuesta Estándar',
        texto: `🏡 PROPUESTA DE RESERVA [PROPUESTA_ID]
Fecha de Emisión: [FECHA_EMISION] — Válida hasta: [FECHA_VENCIMIENTO_PROPUESTA]

Estimado/a [CLIENTE_NOMBRE], es un placer cotizarle la siguiente propuesta de estadía en [EMPRESA_NOMBRE]:

📅 Fechas: [FECHAS_ESTADIA_TEXTO] ([TOTAL_NOCHES] noches)
👥 Personas: [GRUPO_SOLICITADO]

🏠 Detalle de Alojamiento:
[DETALLE_PROPIEDADES_PROPUESTA]

[RESUMEN_VALORES_PROPUESTA]

📌 Para confirmar su reserva, se requiere un abono del [PORCENTAJE_ABONO] ([MONTO_ABONO]).

[CONDICIONES_RESERVA]

Saludos cordiales,
[USUARIO_NOMBRE]
📱 [USUARIO_TELEFONO]
🌐 [EMPRESA_WEBSITE]`
    },
    'presupuesto': {
        nombre: 'Presupuesto Estándar',
        texto: `💰 PRESUPUESTO DE ESTADÍA
[EMPRESA_NOMBRE] | [EMPRESA_WEBSITE]

Cliente: [CLIENTE_NOMBRE]
📅 Fechas: [FECHAS_ESTADIA] ([TOTAL_NOCHES] noches)
👥 Personas: [GRUPO_HUESPEDES]

🏡 Alojamientos disponibles:
[DETALLE_PROPIEDADES_PRESUPUESTO]

[RESUMEN_VALORES_PRESUPUESTO]

Para más información:
[USUARIO_NOMBRE] | [USUARIO_TELEFONO]
[EMPRESA_WEBSITE]`
    },
    'mensaje de reserva': {
        nombre: 'Confirmación de Reserva',
        texto: `✅ RESERVA CONFIRMADA — [EMPRESA_NOMBRE]
Reserva N°: [RESERVA_ID_CANAL]

Estimado/a [CLIENTE_NOMBRE], su reserva ha sido confirmada.

📅 Check-in:  [FECHA_LLEGADA] (desde las 15:00 hrs)
📅 Check-out: [FECHA_SALIDA] (hasta las 11:00 hrs)
🏠 Alojamiento: [ALOJAMIENTO_NOMBRE]
👥 Huéspedes: [CANTIDAD_HUESPEDES]

💳 Saldo pendiente: [SALDO_PENDIENTE]

[CONDICIONES_RESERVA]

¡Le esperamos!
[USUARIO_NOMBRE] — 📱 [USUARIO_TELEFONO]
[EMPRESA_NOMBRE] | [EMPRESA_WEBSITE]`
    },
    'mensaje de salida': {
        nombre: 'Mensaje Post-Estadía',
        texto: `🙏 ¡GRACIAS POR SU VISITA! — [EMPRESA_NOMBRE]

Estimado/a [CLIENTE_NOMBRE], gracias por elegirnos.

Esperamos que su estadía haya superado sus expectativas. Si tiene algún comentario o sugerencia, no dude en contactarnos.

¡Hasta pronto y esperamos verle nuevamente!

[USUARIO_NOMBRE]
📱 [USUARIO_TELEFONO]
[EMPRESA_NOMBRE] | [EMPRESA_WEBSITE]`
    }
};

/**
 * Paso 7: Sincronizar tipos de plantilla y plantillas por defecto (upsert).
 */
async function _sincronizarPlantillas(db, empresaId, result) {
    console.log(`[Importer] 7️⃣  Verificando plantillas por defecto...`);
    try {
        const tiposExistentes = await obtenerTiposPlantilla(db, empresaId);
        const plantillasExistentes = await obtenerPlantillasPorEmpresa(db, empresaId);
        const tiposMap = new Map(tiposExistentes.map(t => [normalizeKey(t.nombre), t]));

        for (const tipoDef of TIPOS_PLANTILLA_DEFAULT) {
            const key = normalizeKey(tipoDef.nombre);
            let tipo = tiposMap.get(key);

            if (!tipo) {
                tipo = await crearTipoPlantilla(db, empresaId, tipoDef);
                tiposMap.set(key, tipo);
                console.log(`[Importer]   ✅ TipoPlantilla creado: "${tipoDef.nombre}"`);
            } else {
                result.omitidos.push(`TipoPlantilla "${tipoDef.nombre}" (ya existe)`);
            }

            const yaExistePlantilla = plantillasExistentes.some(p => p.tipoId === tipo.id);
            if (!yaExistePlantilla && PLANTILLAS_TEXTO_DEFAULT[key]) {
                const def = PLANTILLAS_TEXTO_DEFAULT[key];
                await crearPlantilla(db, empresaId, {
                    nombre: def.nombre,
                    tipoId: tipo.id,
                    texto: def.texto,
                    enviarPorEmail: false,
                    destinatarios: []
                });
                console.log(`[Importer]   ✅ Plantilla creada: "${def.nombre}"`);
            }
        }
    } catch (err) {
        result.errores.push(`Plantillas por defecto: ${err.message}`);
        console.error(`[Importer]   ❌ Error creando plantillas:`, err.message);
    }
}

module.exports = {
    normalizeKey,
    singularKey,
    _resolverEmpresa,
    _actualizarInfoEmpresa,
    _sincronizarCanales,
    _sincronizarTiposElemento,
    _sincronizarTiposComponente,
    _sincronizarPropiedades,
    _sincronizarPlantillas,
};
