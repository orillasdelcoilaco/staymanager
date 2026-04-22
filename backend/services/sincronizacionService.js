// backend/services/sincronizacionService.js

const pool = require('../db/postgres');
const xlsx = require('xlsx');
const { crearOActualizarCliente, recalcularEstadisticasClientes } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService');
const { obtenerValorDolar, actualizarValorDolarApi } = require('./dolarService');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { registrarCarga } = require('./historialCargasService');

// --- INICIO DE LA MODIFICACIÓN: Importar los servicios centrales ---
// Importar 'calculatePrice' (KPI) y 'calcularValoresBaseDesdeReporte' (Fórmula)
const { calculatePrice, calcularValoresBaseDesdeReporte } = require('./utils/calculoValoresService');
// --- FIN DE LA MODIFICACIÓN ---


const leerArchivo = (buffer, nombreArchivo) => {
    const esCsv = nombreArchivo && nombreArchivo.toLowerCase().endsWith('.csv');
    if (esCsv) {
        const data = buffer.toString('utf8');
        const workbook = xlsx.read(data, { type: 'string', cellDates: true, raw: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        return xlsx.utils.sheet_to_json(sheet, { header: 1 });
    }
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
};

const analizarCabeceras = async (buffer, nombreArchivo) => {
    const rows = leerArchivo(buffer, nombreArchivo);
    return rows.length > 0 ? rows[0].filter(Boolean) : [];
};

const analizarValoresUnicosColumna = async (buffer, nombreArchivo, indiceColumna) => {
    const rows = leerArchivo(buffer, nombreArchivo);
    if (rows.length < 2) return [];
    
    const valores = new Set();
    for (let i = 1; i < rows.length; i++) {
        const valor = rows[i][indiceColumna];
        if (valor !== undefined && valor !== null && valor.toString().trim() !== '') {
            valores.add(valor.toString().trim());
        }
    }
    return Array.from(valores);
};

const obtenerValorConMapeo = (fila, campoInterno, mapeosDelCanal) => {
    const mapeo = mapeosDelCanal.find(m => m.campoInterno === campoInterno);
    if (!mapeo || typeof mapeo.columnaIndex !== 'number' || mapeo.columnaIndex < 0) {
        return undefined;
    }
    return fila[mapeo.columnaIndex];
};

const parsearFecha = (dateValue, formatoFecha = 'DD/MM/YYYY') => {
// ... (Esta función no cambia) ...
    if (!dateValue) return null;
    if (dateValue instanceof Date && !isNaN(dateValue)) return dateValue;
    if (typeof dateValue === 'number') {
        return new Date(Date.UTC(1899, 11, 30, 0, 0, 0, 0) + dateValue * 86400000);
    }
    if (typeof dateValue !== 'string') return null;

    const dateStr = dateValue.trim().split(' ')[0];
    const match = dateStr.match(/^(\d{1,4})[\\/.-](\d{1,2})[\\/.-](\d{1,4})$/);

    if (!match) {
        const genericDate = new Date(dateStr);
        if (!isNaN(genericDate.getTime())) {
            return new Date(Date.UTC(genericDate.getFullYear(), genericDate.getMonth(), genericDate.getDate()));
        }
        return null;
    }

    let day, month, year;

    switch (formatoFecha) {
        case 'YYYY-MM-DD':
            [_, year, month, day] = match.map(Number);
            break;
        case 'MM/DD/YYYY':
            [_, month, day, year] = match.map(Number);
            break;
        case 'DD/MM/YYYY':
        case 'D/M/YYYY':
        default:
            [_, day, month, year] = match.map(Number);
            break;
    }

    if (year < 100) year += 2000;
    
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(date) && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return date;
    }

    return null;
};

const normalizarString = (texto) => {
// ... (Esta función no cambia) ...
    if (!texto) return '';
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, ' ');
};

const ESTADO_CANONICAL = {
    'confirmada': 'Confirmada', 'cancelada': 'Cancelada',
    'pendiente': 'Pendiente',   'no_show':   'No Show',
    'modificada': 'Modificada', 'ignorar':   'Ignorar',
    'desconocido': 'Desconocido',
};

const determinarEstado = (estadoCrudo, mapeosDeEstado) => {
    if (!estadoCrudo) return 'Desconocido';
    const estadoNormalizado = normalizarString(estadoCrudo);
    for (const [key, value] of Object.entries(mapeosDeEstado)) {
        if (normalizarString(key) === estadoNormalizado) {
            const canonical = value ? ESTADO_CANONICAL[value.toLowerCase()] : null;
            return canonical || (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Desconocido');
        }
    }
    return 'Desconocido';
};

const parsearMoneda = (valor, separadorDecimal = ',') => {
// ... (Esta función no cambia) ...
    if (valor === undefined || valor === null) return 0;
    
    const valorStr = valor.toString().trim();
    
    let numeroFormateado;
    if (separadorDecimal === ',') {
        numeroFormateado = valorStr.replace(/[^\d,-]/g, "").replace(/\./g, '').replace(',', '.');
    } else {
        numeroFormateado = valorStr.replace(/[^\d.-]/g, "").replace(/,/g, '');
    }
    
    return parseFloat(numeroFormateado) || 0;
};

const _cargarDatosIniciales = async (db, empresaId) => {
    const [conversiones, mapeos, canales, propiedades, tarifasResult] = await Promise.all([
        obtenerConversionesPorEmpresa(db, empresaId),
        obtenerMapeosPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId),
        obtenerPropiedadesPorEmpresa(db, empresaId),
        pool.query(
            `SELECT ta.id, ta.propiedad_id, ta.precio_base, ta.precios_canales,
                     te.fecha_inicio, te.fecha_termino
              FROM tarifas ta JOIN temporadas te ON te.id = ta.temporada_id
              WHERE ta.empresa_id = $1`,
            [empresaId]
        ),
    ]);

    const allTarifas = tarifasResult.rows.map(row => ({
        id:            row.id,
        alojamientoId: row.propiedad_id,
        precioBase:    parseFloat(row.precio_base),
        fechaInicio:   new Date(String(row.fecha_inicio).split('T')[0]  + 'T00:00:00Z'),
        fechaTermino:  new Date(String(row.fecha_termino).split('T')[0] + 'T00:00:00Z'),
        precios:       row.precios_canales || {},
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

async function _procesarAlojamientoEnReserva({ db, empresaId, idCarga, idReservaCanal, canalId, canalNombre, estadoFinal,
    fechaLlegada, fechaSalida, formatoFecha, get, monedaCanal, separadorDecimal,
    configuracionIva, allTarifas, alojamientosDeReserva, alojamiento, valorDolarDia, today, resultadoCliente }) {
    const proporcion = 1 / alojamientosDeReserva.length;
    const datosMapeo = {
        valorAnfitrion:  parsearMoneda(get('valorAnfitrion'),  separadorDecimal) * proporcion,
        comisionSumable: parsearMoneda(get('comision'),        separadorDecimal) * proporcion,
        costoCanal:      parsearMoneda(get('costoCanal'),      separadorDecimal) * proporcion
    };
    const valoresCalculados   = calcularValoresBaseDesdeReporte(datosMapeo, configuracionIva);
    const precioBaseTeorico   = await calculatePrice(db, empresaId, [alojamiento], fechaLlegada, fechaSalida, allTarifas, canalId);
    const convertirACLP       = (monto) => (monedaCanal === 'USD' && valorDolarDia) ? monto * valorDolarDia : monto;
    const totalNoches         = Math.round((fechaSalida - fechaLlegada) / (1000 * 60 * 60 * 24));
    const datosReserva = _construirDatosReserva({
        empresaId, idUnicoReserva: idReservaCanal + '-' + alojamiento.id, idCarga,
        idReservaCanal, canalId, canalNombre, estadoFinal,
        fechaReserva: parsearFecha(get('fechaReserva'), formatoFecha), fechaLlegada, fechaSalida, totalNoches,
        cantidadHuespedes: Math.ceil((parseInt(get('invitados')) || alojamiento.capacidad || 1) / alojamientosDeReserva.length),
        resultadoCliente, alertaBloqueo: resultadoCliente.cliente.bloqueado === true,
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
    return crearOActualizarReserva(db, empresaId, datosReserva);
}

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
                const res = await _procesarAlojamientoEnReserva({
                    db, empresaId, idCarga, idReservaCanal, canalId, canalNombre, estadoFinal,
                    fechaLlegada, fechaSalida, formatoFecha, get, monedaCanal, separadorDecimal,
                    configuracionIva, allTarifas, alojamientosDeReserva, alojamiento, valorDolarDia,
                    today, resultadoCliente
                });
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

module.exports = {
    procesarArchivoReservas,
    analizarCabeceras,
    analizarValoresUnicosColumna
};