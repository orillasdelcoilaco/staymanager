const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService');
const { obtenerValorDolar } = require('./dolarService');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');

const leerArchivo = (buffer, nombreArchivo) => {
    const esCsv = nombreArchivo && nombreArchivo.toLowerCase().endsWith('.csv');

    if (esCsv) {
        const data = buffer.toString('utf8');
        const workbook = xlsx.read(data, { type: 'string', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        return xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
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

const obtenerValorConMapeo = (fila, campoInterno, mapeosDelCanal) => {
    const mapeo = mapeosDelCanal.find(m => m.campoInterno === campoInterno);
    
    if (!mapeo || typeof mapeo.columnaIndex !== 'number' || mapeo.columnaIndex < 0) {
        return undefined;
    }
    
    return fila[mapeo.columnaIndex];
};

const parsearFecha = (dateValue, formatoFecha = 'DD/MM/YYYY') => {
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
    if (!texto) return '';
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, ' ');
};

const normalizarEstado = (estado) => {
    if (!estado) return 'Confirmada';
    const estadoLower = estado.toString().toLowerCase();
    if (estadoLower.includes('cancel') || estadoLower.includes('cancellation')) {
        return 'Cancelada';
    }
    if (estadoLower.includes('ok') || estadoLower.includes('confirm')) {
        return 'Confirmada';
    }
    return 'Confirmada'; 
};

const procesarArchivoReservas = async (db, empresaId, canalId, bufferArchivo, nombreArchivoOriginal = '') => {
    const rows = leerArchivo(bufferArchivo, nombreArchivoOriginal);
    if (rows.length < 2) {
        throw new Error("El archivo está vacío o no tiene filas de datos.");
    }
    
    const cabeceras = rows[0];
    const datosJson = rows.slice(1);

    const [conversionesAlojamiento, todosLosMapeos, canales, propiedades] = await Promise.all([
        obtenerConversionesPorEmpresa(db, empresaId),
        obtenerMapeosPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId),
        obtenerPropiedadesPorEmpresa(db, empresaId)
    ]);

    const mapeosDelCanal = todosLosMapeos.filter(m => m.canalId === canalId);
    const canal = canales.find(c => c.id === canalId);
    if (!canal) throw new Error(`El canal con ID ${canalId} no fue encontrado.`);
    
    const formatoFecha = canal.formatoFecha || 'DD/MM/YYYY'; // Usar el formato guardado o un default
    const canalNombre = canal.nombre;
    const monedaCanal = canal.moneda || 'CLP';
    
    let resultados = { totalFilas: datosJson.length, reservasCreadas: 0, reservasActualizadas: 0, reservasSinCambios: 0, clientesCreados: 0, filasIgnoradas: 0, errores: [] };

    for (const [index, filaArray] of datosJson.entries()) {
        let idFilaParaError = `Fila ${index + 2}`;
        try {
            const get = (campo) => obtenerValorConMapeo(filaArray, campo, mapeosDelCanal);

            const idReservaCanal = get('idReservaCanal');
            if (idReservaCanal) idFilaParaError = idReservaCanal;

            const tipoFila = get('tipoFila');
            if ((tipoFila && tipoFila.toLowerCase().indexOf('reserv') === -1) || !idReservaCanal) {
                resultados.filasIgnoradas++;
                continue;
            }

            let fechaLlegada = parsearFecha(get('fechaLlegada'), formatoFecha);
            let fechaSalida = parsearFecha(get('fechaSalida'), formatoFecha);

            if (!fechaLlegada || !fechaSalida) {
                throw new Error(`No se pudieron interpretar las fechas para la reserva.`);
            }

            if (fechaSalida <= fechaLlegada) {
                throw new Error('La fecha de salida debe ser posterior a la de llegada.');
            }
            
            const nombre = get('nombreCliente') || '';
            const apellido = get('apellidoCliente') || '';
            const nombreClienteCompleto = `${nombre} ${apellido}`.trim();

            const telefonoCliente = get('telefonoCliente');
            const correoCliente = get('correoCliente');
            let pais = get('pais') || 'CL';
            let datosParaCliente = { nombre: nombreClienteCompleto, telefono: telefonoCliente, email: correoCliente, pais };
            if (!telefonoCliente) {
                const idCompuesto = `${nombreClienteCompleto}-${idReservaCanal}-${canalNombre}`.replace(/\s+/g, '-').toLowerCase();
                datosParaCliente.idCompuesto = idCompuesto;
            }
            const resultadoCliente = await crearOActualizarCliente(db, empresaId, datosParaCliente);
            if (resultadoCliente.status === 'creado') resultados.clientesCreados++;
            
            const nombreExternoAlojamiento = get('alojamientoNombre');
            let alojamientoId = null;
            let alojamientoNombre = 'Alojamiento no identificado';
            let capacidadAlojamiento = 0;
            const nombreExternoNormalizado = normalizarString(nombreExternoAlojamiento);
            if (nombreExternoNormalizado) {
                const conversion = conversionesAlojamiento.find(c => c.canalId === canalId && c.nombreExterno.split(';').map(normalizarString).includes(nombreExternoNormalizado));
                if (conversion) {
                    alojamientoId = conversion.alojamientoId;
                    alojamientoNombre = conversion.alojamientoNombre;
                    const propiedad = propiedades.find(p => p.id === alojamientoId);
                    if (propiedad) capacidadAlojamiento = propiedad.capacidad;
                }
            }

            let valorTotal = parseFloat(get('valorTotal')?.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.')) || 0;
            if (monedaCanal === 'USD' && fechaLlegada) {
                const valorDolarDia = await obtenerValorDolar(fechaLlegada);
                valorTotal = valorTotal * valorDolarDia;
            }

            const totalNoches = (fechaLlegada && fechaSalida) ? Math.round((fechaSalida - fechaLlegada) / (1000 * 60 * 60 * 24)) : 0;

            const datosReserva = {
                idReservaCanal: idReservaCanal.toString(), canalId, canalNombre,
                estado: normalizarEstado(get('estado')),
                fechaReserva: parsearFecha(get('fechaReserva'), formatoFecha),
                fechaLlegada,
                fechaSalida,
                totalNoches: totalNoches > 0 ? totalNoches : 1,
                cantidadHuespedes: parseInt(get('invitados')) || capacidadAlojamiento,
                clienteId: resultadoCliente.cliente.id,
                alojamientoId, alojamientoNombre,
                moneda: 'CLP',
                valores: {
                    valorTotal,
                    comision: parseFloat(get('comision')?.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.')) || 0,
                    abono: parseFloat(get('abono')) || 0,
                    pendiente: parseFloat(get('pendiente')) || 0
                },
            };
            
            const res = await crearOActualizarReserva(db, empresaId, datosReserva);
            if(res.status === 'creada') resultados.reservasCreadas++;
            if(res.status === 'actualizada') resultados.reservasActualizadas++;
            if(res.status === 'sin_cambios') resultados.reservasSinCambios++;

        } catch (error) {
            console.error('Error procesando fila:', filaArray, error);
            resultados.errores.push({ fila: idFilaParaError, error: error.message });
        }
    }

    return resultados;
};

module.exports = {
    procesarArchivoReservas,
    analizarCabeceras
};