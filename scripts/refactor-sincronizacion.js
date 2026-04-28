// Temporary refactor script — delete after use
const fs = require('fs');
const filePath = 'D:/pmeza/Desarrollos Render/staymanager/backend/services/sincronizacionService.js';
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = 'const procesarArchivoReservas = async';
const endMarker = '\nmodule.exports = {';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error('Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
    process.exit(1);
}

const before = content.slice(0, startIdx);
const after = content.slice(endIdx);

const newBlock = `const _cargarDatosIniciales = async (db, empresaId) => {
    const [conversiones, mapeos, canales, propiedades, tarifasResult] = await Promise.all([
        obtenerConversionesPorEmpresa(db, empresaId),
        obtenerMapeosPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId),
        obtenerPropiedadesPorEmpresa(db, empresaId),
        pool
            ? pool.query(
                \`SELECT ta.id, ta.propiedad_id, ta.precio_base, ta.precios_canales,
                         te.fecha_inicio, te.fecha_termino
                  FROM tarifas ta JOIN temporadas te ON te.id = ta.temporada_id
                  WHERE ta.empresa_id = $1\`,
                [empresaId]
              )
            : db.collection('empresas').doc(empresaId).collection('tarifas').get(),
    ]);

    const allTarifas = pool
        ? tarifasResult.rows.map(row => ({
            id:            row.id,
            alojamientoId: row.propiedad_id,
            precioBase:    parseFloat(row.precio_base),
            fechaInicio:   new Date(String(row.fecha_inicio).split('T')[0]  + 'T00:00:00Z'),
            fechaTermino:  new Date(String(row.fecha_termino).split('T')[0] + 'T00:00:00Z'),
            precios:       row.precios_canales || {},
          }))
        : tarifasResult.docs.map(doc => ({
            ...doc.data(), id: doc.id,
            fechaInicio: doc.data().fechaInicio.toDate(),
            fechaTermino: doc.data().fechaTermino.toDate()
          }));

    return { conversiones, mapeos, canales, propiedades, allTarifas };
};

const _resolverMapeosCentral = async (db, canal, canalId, mapeosDelCanal) => {
    if (mapeosDelCanal.length > 0) return mapeosDelCanal;

    const { obtenerMapeoCentralPorNombre } = require('./mapeosCentralesService');
    const mapeoCentral = await obtenerMapeoCentralPorNombre(db, canal.nombre);
    if (mapeoCentral && mapeoCentral.mapeos && mapeoCentral.mapeos.length > 0) {
        const mapeos = mapeoCentral.mapeos.map(m => ({
            id: canalId + '_' + m.campoInterno,
            canalId,
            campoInterno: m.campoInterno,
            columnaIndex: m.columnaIndex
        }));
        if (!canal.formatoFecha) canal.formatoFecha = mapeoCentral.formatoFecha;
        if (!canal.separadorDecimal) canal.separadorDecimal = mapeoCentral.separadorDecimal;
        if (!canal.configuracionIva) canal.configuracionIva = mapeoCentral.configuracionIva;
        if (!canal.mapeosDeEstado || Object.keys(canal.mapeosDeEstado).length === 0) canal.mapeosDeEstado = mapeoCentral.mapeosDeEstado;
        console.log('[Sincronizacion] Mapeo central aplicado para "' + canal.nombre + '"');
        return mapeos;
    }
    return mapeosDelCanal;
};

const _construirDatosReserva = (ctx) => {
    const {
        empresaId, idUnicoReserva, idCarga, idReservaCanal, canalId, canalNombre,
        estadoFinal, fechaReserva, fechaLlegada, fechaSalida, totalNoches,
        cantidadHuespedes, resultadoCliente, alertaBloqueo, motivoBloqueo,
        alojamiento, moneda, valores, valorDolarDia, today
    } = ctx;

    return {
        empresaId, idUnicoReserva, idCarga, idReservaCanal: idReservaCanal.toString(), canalId, canalNombre,
        estado: estadoFinal, estadoGestion: estadoFinal === 'Confirmada' ? 'Pendiente Bienvenida' : null,
        fechaReserva, fechaLlegada, fechaSalida, totalNoches: totalNoches > 0 ? totalNoches : 1,
        cantidadHuespedes,
        clienteId: resultadoCliente.cliente.id,
        alertaBloqueo, motivoBloqueo,
        alojamientoId: alojamiento.id, alojamientoNombre: alojamiento.nombre,
        moneda,
        valores,
        valorDolarDia, requiereActualizacionDolar: moneda === 'USD' && fechaLlegada > today
    };
};

const procesarArchivoReservas = async (db, empresaId, canalId, bufferArchivo, nombreArchivoOriginal, usuarioEmail) => {
    await actualizarValorDolarApi(db, empresaId);

    const idCarga = await registrarCarga(db, empresaId, canalId, nombreArchivoOriginal, usuarioEmail);

    const rows = leerArchivo(bufferArchivo, nombreArchivoOriginal);
    if (rows.length < 2) throw new Error("El archivo esta vacio o no tiene filas de datos.");

    const cabeceras = rows[0];
    const datosJson = rows.slice(1);

    const { conversiones: conversionesAlojamiento, mapeos: todosLosMapeos, canales, propiedades, allTarifas } = await _cargarDatosIniciales(db, empresaId);

    const canal = canales.find(c => c.id === canalId);
    if (!canal) throw new Error('El canal con ID ' + canalId + ' no fue encontrado.');

    let mapeosDelCanal = todosLosMapeos.filter(m => m.canalId === canalId);
    mapeosDelCanal = await _resolverMapeosCentral(db, canal, canalId, mapeosDelCanal);

    if (mapeosDelCanal.length === 0) {
        throw new Error('No hay mapeo configurado para "' + canal.nombre + '". Ve a Configuracion > Mapeos Centrales para aplicarlo.');
    }

    const formatoFecha = canal.formatoFecha || 'DD/MM/YYYY';
    const separadorDecimal = canal.separadorDecimal || ',';
    const canalNombre = canal.nombre;
    const monedaCanal = canal.moneda || 'CLP';
    const configuracionIva = canal.configuracionIva || 'incluido';
    const mapeosDeEstado = canal.mapeosDeEstado || {};

    let resultados = { totalFilas: datosJson.length, reservasCreadas: 0, reservasActualizadas: 0, reservasSinCambios: 0, clientesCreados: 0, filasIgnoradas: 0, errores: [] };
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const [index, filaArray] of datosJson.entries()) {
        const get = (campo) => obtenerValorConMapeo(filaArray, campo, mapeosDelCanal);
        let idFilaParaError = 'Fila ' + (index + 2);
        try {
            const idReservaCanal = get('idReservaCanal');
            if (idReservaCanal) idFilaParaError = idReservaCanal;

            const estadoFinal = determinarEstado(get('estado'), mapeosDeEstado);
            if (estadoFinal === 'Ignorar' || !idReservaCanal) { resultados.filasIgnoradas++; continue; }

            const fechaLlegada = parsearFecha(get('fechaLlegada'), formatoFecha);
            const fechaSalida = parsearFecha(get('fechaSalida'), formatoFecha);
            if (!fechaLlegada || !fechaSalida) throw new Error('No se pudieron interpretar las fechas.');
            if (fechaSalida <= fechaLlegada) throw new Error('La fecha de salida debe ser posterior a la de llegada.');

            const nombreClienteCompleto = ((get('nombreCliente') || '') + ' ' + (get('apellidoCliente') || '')).trim();
            const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
                nombre: nombreClienteCompleto,
                telefono: get('telefonoCliente'),
                email: get('correoCliente'),
                pais: get('pais') || 'CL',
                canalNombre,
                idReservaCanal
            });
            if (resultadoCliente.status === 'creado') resultados.clientesCreados++;

            const nombresExternosAlojamientos = [(get('alojamientoNombre') || '').toString().trim()].filter(Boolean);
            if (nombresExternosAlojamientos.length === 0) throw new Error("La columna de alojamiento esta vacia o es invalida.");

            const valorDolarDia = monedaCanal === 'USD' ? await obtenerValorDolar(db, empresaId, fechaLlegada) : null;

            const alojamientosDeReserva = [];
            for (const nombreExterno of nombresExternosAlojamientos) {
                const nombreExternoNormalizado = normalizarString(nombreExterno);
                const conversion = conversionesAlojamiento.find(c => c.canalId === canalId && c.nombreExterno.split(';').map(normalizarString).includes(nombreExternoNormalizado));
                let propiedadId = conversion ? conversion.alojamientoId : null;
                if (!propiedadId) {
                    const directa = propiedades.find(p => normalizarString(p.nombre) === nombreExternoNormalizado);
                    if (!directa) throw new Error('No se encontro una conversion para el alojamiento "' + nombreExterno + '" en el canal ' + canalNombre + '.');
                    propiedadId = directa.id;
                }
                const propiedad = propiedades.find(p => p.id === propiedadId);
                if (!propiedad) throw new Error('La propiedad interna con ID ' + propiedadId + ' no fue encontrada.');
                alojamientosDeReserva.push(propiedad);
            }

            for (const alojamiento of alojamientosDeReserva) {
                const proporcion = 1 / alojamientosDeReserva.length;
                const datosMapeo = {
                    valorAnfitrion: parsearMoneda(get('valorAnfitrion'), separadorDecimal) * proporcion,
                    comisionSumable: parsearMoneda(get('comision'), separadorDecimal) * proporcion,
                    costoCanal: parsearMoneda(get('costoCanal'), separadorDecimal) * proporcion
                };
                const valoresCalculados = calcularValoresBaseDesdeReporte(datosMapeo, configuracionIva);
                const precioBaseTeorico = await calculatePrice(db, empresaId, [alojamiento], fechaLlegada, fechaSalida, allTarifas, canalId);
                const convertirACLP = (monto) => (monedaCanal === 'USD' && valorDolarDia) ? monto * valorDolarDia : monto;
                const totalNoches = Math.round((fechaSalida - fechaLlegada) / (1000 * 60 * 60 * 24));

                const datosReserva = _construirDatosReserva({
                    empresaId, idUnicoReserva: idReservaCanal + '-' + alojamiento.id, idCarga,
                    idReservaCanal, canalId, canalNombre, estadoFinal,
                    fechaReserva: parsearFecha(get('fechaReserva'), formatoFecha), fechaLlegada, fechaSalida, totalNoches,
                    cantidadHuespedes: Math.ceil((parseInt(get('invitados')) || alojamiento.capacidad || 1) / alojamientosDeReserva.length),
                    resultadoCliente,
                    alertaBloqueo: resultadoCliente.cliente.bloqueado === true,
                    motivoBloqueo: resultadoCliente.cliente.motivoBloqueo || '',
                    alojamiento, moneda: monedaCanal,
                    valores: {
                        valorHuesped: Math.round(convertirACLP(valoresCalculados.valorHuespedOriginal)),
                        valorTotal:   Math.round(convertirACLP(valoresCalculados.valorTotalOriginal)),
                        comision:     Math.round(convertirACLP(valoresCalculados.comisionOriginal)),
                        costoCanal:   Math.round(convertirACLP(valoresCalculados.costoCanalOriginal)),
                        iva:          Math.round(convertirACLP(valoresCalculados.ivaOriginal)),
                        valorOriginal: precioBaseTeorico.totalPriceOriginal,
                        ...valoresCalculados
                    },
                    valorDolarDia, today
                });

                const res = await crearOActualizarReserva(db, empresaId, datosReserva);
                if (res.status === 'creada') resultados.reservasCreadas++;
                else if (res.status === 'actualizada') resultados.reservasActualizadas++;
                else if (res.status === 'sin_cambios') resultados.reservasSinCambios++;
            }

        } catch (error) {
            console.error('Error procesando fila ' + idFilaParaError + ':', error);
            resultados.errores.push({ fila: idFilaParaError, error: error.message });
        }
    }

    recalcularEstadisticasClientes(db, empresaId).catch(err => {
        console.error('[Background Job] Error al recalcular estadisticas para la empresa ' + empresaId + ':', err);
    });

    return resultados;
};
`;

const newContent = before + newBlock + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('File written successfully.');
console.log('Total length:', newContent.length);
