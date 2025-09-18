const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerValorDolar } = require('./dolarService');

/**
 * Procesa un archivo de reservas (CSV o XLS) y consolida los datos.
 */
const procesarArchivoReservas = async (db, empresaId, bufferArchivo) => {
    const workbook = xlsx.read(bufferArchivo, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { raw: false });

    // Cargar datos necesarios para el procesamiento una sola vez
    const conversiones = await obtenerConversionesPorEmpresa(db, empresaId);
    const canales = await obtenerCanalesPorEmpresa(db, empresaId);
    const valorDolarHoy = await obtenerValorDolar(new Date());

    let resultados = {
        totalFilas: jsonData.length,
        reservasCreadas: 0,
        reservasActualizadas: 0,
        clientesCreados: 0,
        errores: []
    };

    for (const fila of jsonData) {
        try {
            // 1. Identificar Canal
            const canalNombre = fila.Canal || 'Desconocido';
            const canal = canales.find(c => c.nombre.toLowerCase() === canalNombre.toLowerCase());

            // 2. Identificar Alojamiento usando la Tabla de Conversión
            let alojamientoId = null;
            let alojamientoNombre = 'Alojamiento no identificado';
            const nombreExterno = fila.Alojamiento || '';
            const conversion = conversiones.find(c => c.nombreExterno.trim().toLowerCase() === nombreExterno.trim().toLowerCase());
            
            if (conversion) {
                alojamientoId = conversion.alojamientoId;
                alojamientoNombre = conversion.alojamientoNombre;
            }

            // 3. Crear o Actualizar Cliente
            const datosCliente = {
                nombre: fila.Nombre || 'Cliente por Asignar',
                telefono: fila.Telefono, // El servicio se encarga del teléfono genérico si es nulo
                email: fila.Correo || '',
                pais: fila.Pais || ''
            };
            const cliente = await crearOActualizarCliente(db, empresaId, datosCliente);
            if (cliente.fechaCreacion) resultados.clientesCreados++;

            // 4. Procesar Valores y Moneda
            let valorCLP = parseFloat(fila['Valor CLP']) || 0;
            if (fila.Moneda === 'USD' && fila['Valor Dolar']) {
                valorCLP = parseFloat(fila['Valor Dolar']) * valorDolarHoy;
            }

            // 5. Construir Objeto de Reserva
            const datosReserva = {
                idReservaCanal: fila.Reserva?.toString() || `sin-id-${Date.now()}`,
                canalId: canal ? canal.id : null,
                canalNombre: canalNombre,
                estado: fila.Estado || 'Pendiente',
                fechaReserva: fila['Fecha reserva'],
                fechaLlegada: fila['Fecha Llegada'],
                fechaSalida: fila['Fecha Salida'],
                totalNoches: parseInt(fila['Total Noches']) || 0,
                cantidadHuespedes: parseInt(fila.Invitados) || 0,
                clienteId: cliente.id,
                alojamientoId: alojamientoId,
                alojamientoNombre: alojamientoNombre,
                moneda: fila.Moneda || 'CLP',
                valores: {
                    valorTotal: valorCLP,
                    comision: parseFloat(fila.Comision) || 0,
                    abono: parseFloat(fila.Abono) || 0,
                    pendiente: parseFloat(fila.Pendiente) || 0
                },
                // TODO: Mapear historial de pagos si es necesario
            };
            
            // 6. Crear o Actualizar Reserva
            const resultadoReserva = await crearOActualizarReserva(db, empresaId, datosReserva);
            if(resultadoReserva.status === 'creada') resultados.reservasCreadas++;
            if(resultadoReserva.status === 'actualizada') resultados.reservasActualizadas++;

        } catch (error) {
            console.error('Error procesando fila:', fila, error);
            resultados.errores.push({ fila: fila.Reserva || 'N/A', error: error.message });
        }
    }

    return resultados;
};

module.exports = {
    procesarArchivoReservas
};