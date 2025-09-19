const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService');
const { obtenerValorDolar } = require('./dolarService');

const obtenerValorConMapeo = (fila, campoInterno, mapeosDelCanal) => {
    const mapeo = mapeosDelCanal.find(m => m.campoInterno === campoInterno);
    if (!mapeo || !mapeo.nombresExternos) return undefined;
    for (const nombreExterno of mapeo.nombresExternos) {
        if (fila[nombreExterno] !== undefined) return fila[nombreExterno];
    }
    return undefined;
};

// --- NUEVA FUNCIÓN INTELIGENTE PARA FECHAS ---
const parsearFecha = (fechaInput) => {
    if (!fechaInput) return null;
    // Si ya es un objeto Date (leído desde un .xls), lo retornamos.
    if (fechaInput instanceof Date) {
        return fechaInput;
    }
    // Si es un string, intentamos convertirlo.
    const fechaStr = fechaInput.toString();
    // Intenta varios formatos comunes (DD/MM/YYYY, YYYY-MM-DD, etc.)
    // Esta expresión regular maneja formatos con / . o -
    const date = new Date(fechaStr.replace(/(\d{2})[\\/.-](\d{2})[\\/.-](\d{4})/, '$3-$2-$1'));
    // Si la conversión es válida, la retornamos, si no, intentamos con el formato americano
    if (!isNaN(date.getTime())) {
        return date;
    }
    const americanDate = new Date(fechaStr);
    return isNaN(americanDate.getTime()) ? null : americanDate;
};


const procesarArchivoReservas = async (db, empresaId, canalId, bufferArchivo) => {
    const workbook = xlsx.read(bufferArchivo, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { raw: false });

    const conversionesAlojamiento = await obtenerConversionesPorEmpresa(db, empresaId);
    const todosLosMapeos = await obtenerMapeosPorEmpresa(db, empresaId);
    const valorDolarHoy = await obtenerValorDolar(new Date());

    const mapeosDelCanal = todosLosMapeos.filter(m => m.canalId === canalId);
    const canal = (await obtenerCanalesPorEmpresa(db, empresaId)).find(c => c.id === canalId);
    const canalNombre = canal ? canal.nombre : 'Canal Desconocido';

    let resultados = {
        totalFilas: jsonData.length,
        reservasCreadas: 0,
        reservasActualizadas: 0,
        reservasSinCambios: 0,
        clientesCreados: 0,
        filasIgnoradas: 0,
        errores: []
    };

    for (const [index, fila] of jsonData.entries()) {
        let idFilaParaError = `Fila ${index + 2}`;
        try {
            const idReservaCanal = obtenerValorConMapeo(fila, 'idReservaCanal', mapeosDelCanal);
            if (idReservaCanal) idFilaParaError = idReservaCanal;

            const tipoFila = obtenerValorConMapeo(fila, 'tipoFila', mapeosDelCanal);
            if ((tipoFila && tipoFila.toLowerCase() !== 'reservación') || !idReservaCanal) {
                 resultados.filasIgnoradas++;
                 continue;
            }

            let nombreCliente = obtenerValorConMapeo(fila, 'nombreCliente', mapeosDelCanal);
            const telefonoCliente = obtenerValorConMapeo(fila, 'telefonoCliente', mapeosDelCanal);
            const correoCliente = obtenerValorConMapeo(fila, 'correoCliente', mapeosDelCanal);
            const pais = obtenerValorConMapeo(fila, 'pais', mapeosDelCanal);

            let datosParaCliente = { nombre: nombreCliente, telefono: telefonoCliente, email: correoCliente, pais: pais };
            
            if (!telefonoCliente) {
                const nombreBase = nombreCliente || 'Huésped';
                const idReservaBase = idReservaCanal;
                datosParaCliente.nombre = `${nombreBase} - ${idReservaBase} - ${canalNombre}`;
                datosParaCliente.idCompuesto = `${nombreBase}-${idReservaBase}-${canalNombre}`.replace(/\s+/g, '-').toLowerCase();
            }

            const resultadoCliente = await crearOActualizarCliente(db, empresaId, datosParaCliente);
            if (resultadoCliente.status === 'creado') resultados.clientesCreados++;
            
            const estado = obtenerValorConMapeo(fila, 'estado', mapeosDelCanal);
            const fechaReserva = parsearFecha(obtenerValorConMapeo(fila, 'fechaReserva', mapeosDelCanal));
            const fechaLlegada = parsearFecha(obtenerValorConMapeo(fila, 'fechaLlegada', mapeosDelCanal));
            const fechaSalida = parsearFecha(obtenerValorConMapeo(fila, 'fechaSalida', mapeosDelCanal));
            const totalNoches = obtenerValorConMapeo(fila, 'totalNoches', mapeosDelCanal);
            const invitados = obtenerValorConMapeo(fila, 'invitados', mapeosDelCanal);
            const valorTotalCrudo = obtenerValorConMapeo(fila, 'valorTotal', mapeosDelCanal);
            const comision = obtenerValorConMapeo(fila, 'comision', mapeosDelCanal);
            const abono = obtenerValorConMapeo(fila, 'abono', mapeosDelCanal);
            const pendiente = obtenerValorConMapeo(fila, 'pendiente', mapeosDelCanal);
            const nombreExternoAlojamiento = obtenerValorConMapeo(fila, 'alojamientoNombre', mapeosDelCanal);

            let alojamientoId = null;
            let alojamientoNombre = 'Alojamiento no identificado';
            const nombreExternoNormalizado = (nombreExternoAlojamiento || '').trim().toLowerCase();
            if (nombreExternoNormalizado) {
                const conversion = conversionesAlojamiento.find(c => c.nombreExterno.trim().toLowerCase() === nombreExternoNormalizado);
                if (conversion) {
                    alojamientoId = conversion.alojamientoId;
                    alojamientoNombre = conversion.alojamientoNombre;
                }
            }
            
            const moneda = valorTotalCrudo?.toString().toUpperCase().includes('USD') ? 'USD' : 'CLP';
            let valorTotal = 0;
            if (valorTotalCrudo) {
                 const valorNumerico = parseFloat(valorTotalCrudo.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.'));
                 valorTotal = moneda === 'USD' ? valorNumerico * valorDolarHoy : valorNumerico;
            }

            const datosReserva = {
                idReservaCanal: idReservaCanal.toString(),
                canalId: canalId,
                canalNombre: canalNombre,
                estado: estado || 'Pendiente',
                fechaReserva: fechaReserva,
                fechaLlegada: fechaLlegada,
                fechaSalida: fechaSalida,
                totalNoches: parseInt(totalNoches) || 0,
                cantidadHuespedes: parseInt(invitados) || 0,
                clienteId: resultadoCliente.cliente.id,
                alojamientoId: alojamientoId,
                alojamientoNombre: alojamientoNombre,
                moneda: moneda,
                valores: {
                    valorTotal: valorTotal,
                    comision: parseFloat(comision?.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.')) || 0,
                    abono: parseFloat(abono) || 0,
                    pendiente: parseFloat(pendiente) || 0
                },
            };
            
            const resultadoReserva = await crearOActualizarReserva(db, empresaId, datosReserva);
            if(resultadoReserva.status === 'creada') resultados.reservasCreadas++;
            if(resultadoReserva.status === 'actualizada') resultados.reservasActualizadas++;
            if(resultadoReserva.status === 'sin_cambios') resultados.reservasSinCambios++;

        } catch (error) {
            console.error('Error procesando fila:', fila, error);
            resultados.errores.push({ fila: idFilaParaError, error: error.message });
        }
    }

    return resultados;
};

module.exports = {
    procesarArchivoReservas
};