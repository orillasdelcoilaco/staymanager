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
        clientesCreados: 0,
        filasIgnoradas: 0,
        errores: []
    };

    for (const [index, fila] of jsonData.entries()) {
        let idFilaParaError = `Fila ${index + 2}`;
        try {
            const tipoFila = obtenerValorConMapeo(fila, 'tipoFila', mapeosDelCanal);
            if (tipoFila && tipoFila !== 'Reservación') {
                 resultados.filasIgnoradas++;
                 continue;
            }

            const idReservaCanal = obtenerValorConMapeo(fila, 'idReservaCanal', mapeosDelCanal);
            if (idReservaCanal) idFilaParaError = idReservaCanal;

            const nombreCliente = obtenerValorConMapeo(fila, 'nombreCliente', mapeosDelCanal);
            const telefonoCliente = obtenerValorConMapeo(fila, 'telefonoCliente', mapeosDelCanal);
            const correoCliente = obtenerValorConMapeo(fila, 'correoCliente', mapeosDelCanal);
            const pais = obtenerValorConMapeo(fila, 'pais', mapeosDelCanal);

            let datosParaCliente = { nombre: nombreCliente, telefono: telefonoCliente, email: correoCliente, pais: pais };
            
            if (!telefonoCliente) {
                const nombreBase = nombreCliente || 'Huésped';
                const idReservaBase = idReservaCanal || 'Sin-ID';
                datosParaCliente.nombre = `${nombreBase} - ${idReservaBase} - ${canalNombre}`;
                datosParaCliente.idCompuesto = `${nombreBase}-${idReservaBase}-${canalNombre}`.replace(/\s+/g, '-').toLowerCase();
            }

            const cliente = await crearOActualizarCliente(db, empresaId, datosParaCliente);
            if (!cliente.fechaActualizacion) resultados.clientesCreados++;
            
            const estado = obtenerValorConMapeo(fila, 'estado', mapeosDelCanal);
            const fechaReserva = obtenerValorConMapeo(fila, 'fechaReserva', mapeosDelCanal);
            const fechaLlegada = obtenerValorConMapeo(fila, 'fechaLlegada', mapeosDelCanal);
            const fechaSalida = obtenerValorConMapeo(fila, 'fechaSalida', mapeosDelCanal);
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
                 const valorNumerico = parseFloat(valorTotalCrudo.toString().replace(/[^0-9.,-]+/g, "").replace(',', '.'));
                 valorTotal = moneda === 'USD' ? valorNumerico * valorDolarHoy : valorNumerico;
            }

            const datosReserva = {
                idReservaCanal: idReservaCanal?.toString() || `sin-id-${Date.now()}`,
                canalId: canalId,
                canalNombre: canalNombre,
                estado: estado || 'Pendiente',
                fechaReserva: fechaReserva || new Date(),
                fechaLlegada: fechaLlegada || null,
                fechaSalida: fechaSalida || null,
                totalNoches: parseInt(totalNoches) || 0,
                cantidadHuespedes: parseInt(invitados) || 0,
                clienteId: cliente.id,
                alojamientoId: alojamientoId,
                alojamientoNombre: alojamientoNombre,
                moneda: moneda,
                valores: {
                    valorTotal: valorTotal,
                    comision: parseFloat(comision?.toString().replace(/[^0-9.,-]+/g, "").replace(',', '.')) || 0,
                    abono: parseFloat(abono) || 0,
                    pendiente: parseFloat(pendiente) || 0
                },
            };
            
            const resultadoReserva = await crearOActualizarReserva(db, empresaId, datosReserva);
            if(resultadoReserva.status === 'creada') resultados.reservasCreadas++;
            if(resultadoReserva.status === 'actualizada') resultados.reservasActualizadas++;

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