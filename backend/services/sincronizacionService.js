const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService'); // <-- ¡NUEVO!
const { obtenerValorDolar } = require('./dolarService');

/**
 * Función auxiliar inteligente que usa las reglas de mapeo para encontrar un valor.
 * @param {object} fila - El objeto que representa la fila del archivo.
 * @param {string} campoInterno - El nombre de nuestro campo interno (ej: 'fechaLlegada').
 * @param {Array<object>} mapeosDelCanal - Las reglas de mapeo para el canal de la fila.
 * @returns {any} - El valor encontrado o undefined.
 */
const obtenerValorConMapeo = (fila, campoInterno, mapeosDelCanal) => {
    const mapeo = mapeosDelCanal.find(m => m.campoInterno === campoInterno);
    if (!mapeo || !mapeo.nombresExternos) {
        return undefined; // No hay regla de mapeo para este campo
    }
    for (const nombreExterno of mapeo.nombresExternos) {
        if (fila[nombreExterno] !== undefined) {
            return fila[nombreExterno];
        }
    }
    return undefined;
};

/**
 * Procesa un archivo de reservas (CSV o XLS) y consolida los datos.
 */
const procesarArchivoReservas = async (db, empresaId, bufferArchivo) => {
    const workbook = xlsx.read(bufferArchivo, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { raw: false });

    // Cargar todas las reglas y datos necesarios una sola vez
    const conversionesAlojamiento = await obtenerConversionesPorEmpresa(db, empresaId);
    const canales = await obtenerCanalesPorEmpresa(db, empresaId);
    const mapeos = await obtenerMapeosPorEmpresa(db, empresaId); // <-- ¡NUEVO!
    const valorDolarHoy = await obtenerValorDolar(new Date());

    let resultados = {
        totalFilas: jsonData.length,
        reservasCreadas: 0,
        reservasActualizadas: 0,
        clientesCreados: 0,
        filasIgnoradas: 0,
        errores: []
    };

    for (const fila of jsonData) {
        let idFilaParaError = 'N/A';
        try {
            // Lógica especial para Airbnb: ignorar filas de pago (Payout)
            if (fila.Tipo === 'Payout' || fila.Tipo === 'Ajuste') {
                 resultados.filasIgnoradas++;
                 continue;
            }

            // 1. Identificar Canal y sus reglas de mapeo
            // El mapeo para 'canalNombre' nos dirá cómo encontrar el nombre del canal en el reporte
            const mapeoCanal = mapeos.find(m => m.campoInterno === 'canalNombre');
            const canalNombre = mapeoCanal ? obtenerValorConMapeo(fila, 'canalNombre', [mapeoCanal]) : fila.Canal || 'Desconocido';
            
            const canal = canales.find(c => c.nombre.toLowerCase() === canalNombre.toLowerCase());
            const mapeosDelCanal = canal ? mapeos.filter(m => m.canalId === canal.id) : [];

            // Usamos la nueva función inteligente para obtener todos los datos
            const idReservaCanal = obtenerValorConMapeo(fila, 'idReservaCanal', mapeosDelCanal);
            idFilaParaError = idReservaCanal || 'Fila sin ID';

            const estado = obtenerValorConMapeo(fila, 'estado', mapeosDelCanal);
            const fechaReserva = obtenerValorConMapeo(fila, 'fechaReserva', mapeosDelCanal);
            const fechaLlegada = obtenerValorConMapeo(fila, 'fechaLlegada', mapeosDelCanal);
            const fechaSalida = obtenerValorConMapeo(fila, 'fechaSalida', mapeosDelCanal);
            const totalNoches = obtenerValorConMapeo(fila, 'totalNoches', mapeosDelCanal);
            const invitados = obtenerValorConMapeo(fila, 'invitados', mapeosDelCanal);
            const nombreCliente = obtenerValorConMapeo(fila, 'nombreCliente', mapeosDelCanal);
            const correoCliente = obtenerValorConMapeo(fila, 'correoCliente', mapeosDelCanal);
            const telefonoCliente = obtenerValorConMapeo(fila, 'telefonoCliente', mapeosDelCanal);
            const valorTotalCrudo = obtenerValorConMapeo(fila, 'valorTotal', mapeosDelCanal);
            const comision = obtenerValorConMapeo(fila, 'comision', mapeosDelCanal);
            const abono = obtenerValorConMapeo(fila, 'abono', mapeosDelCanal);
            const pendiente = obtenerValorConMapeo(fila, 'pendiente', mapeosDelCanal);
            const nombreExternoAlojamiento = obtenerValorConMapeo(fila, 'alojamientoNombre', mapeosDelCanal);
            const pais = obtenerValorConMapeo(fila, 'pais', mapeosDelCanal);

            // 2. Identificar Alojamiento (conversión de valor)
            let alojamientoId = null;
            let alojamientoNombre = 'Alojamiento no identificado';
            const conversion = conversionesAlojamiento.find(c => c.nombreExterno.trim().toLowerCase() === nombreExternoAlojamiento?.trim().toLowerCase());
            if (conversion) {
                alojamientoId = conversion.alojamientoId;
                alojamientoNombre = conversion.alojamientoNombre;
            }

            // 3. Crear o Actualizar Cliente
            const cliente = await crearOActualizarCliente(db, empresaId, {
                nombre: nombreCliente,
                telefono: telefonoCliente,
                email: correoCliente,
                pais: pais
            });
            if (cliente.fechaCreacion) resultados.clientesCreados++;

            // 4. Procesar Valores y Moneda
            const moneda = valorTotalCrudo?.toString().toUpperCase().includes('USD') ? 'USD' : 'CLP';
            let valorTotal = 0;
            if (valorTotalCrudo) {
                 const valorNumerico = parseFloat(valorTotalCrudo.toString().replace(/[^0-9.,-]+/g, "").replace(',', '.'));
                 valorTotal = moneda === 'USD' ? valorNumerico * valorDolarHoy : valorNumerico;
            }

            // 5. Construir Objeto de Reserva
            const datosReserva = {
                idReservaCanal: idReservaCanal?.toString() || `sin-id-${Date.now()}`,
                canalId: canal ? canal.id : null,
                canalNombre: canalNombre,
                estado: estado || 'Pendiente',
                fechaReserva: fechaReserva || new Date(),
                fechaLlegada: fechaLlegada,
                fechaSalida: fechaSalida,
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
            
            // 6. Crear o Actualizar Reserva
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