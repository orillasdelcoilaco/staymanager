const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
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

// El servicio ahora recibe el canalId como un parámetro explícito
const procesarArchivoReservas = async (db, empresaId, canalId, bufferArchivo) => {
    const workbook = xlsx.read(bufferArchivo, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { raw: false });

    const conversionesAlojamiento = await obtenerConversionesPorEmpresa(db, empresaId);
    const todosLosMapeos = await obtenerMapeosPorEmpresa(db, empresaId);
    const valorDolarHoy = await obtenerValorDolar(new Date());

    const mapeosDelCanal = todosLosMapeos.filter(m => m.canalId === canalId);
    const canalNombre = mapeosDelCanal.length > 0 ? mapeosDelCanal[0].canalNombre : 'Canal Desconocido';

    let resultados = { /* ... (igual que antes) */ };

    for (const fila of jsonData) {
        let idFilaParaError = 'N/A';
        try {
            const tipoFila = fila.Tipo || '';
            if (tipoFila && tipoFila !== 'Reservación') {
                 resultados.filasIgnoradas++;
                 continue;
            }

            // Ya no necesitamos adivinar el canal, lo recibimos directamente.
            // Obtenemos todos los datos usando las reglas de mapeo del canal especificado.
            const idReservaCanal = obtenerValorConMapeo(fila, 'idReservaCanal', mapeosDelCanal);
            idFilaParaError = idReservaCanal || 'Fila sin ID';

            let nombreCliente = obtenerValorConMapeo(fila, 'nombreCliente', mapeosDelCanal);
            const telefonoCliente = obtenerValorConMapeo(fila, 'telefonoCliente', mapeosDelCanal);

            if (!telefonoCliente) {
                const nombreBase = nombreCliente || 'Huésped';
                const idReservaBase = idReservaCanal || 'Sin ID';
                nombreCliente = `${nombreBase} - ${idReservaBase} - ${canalNombre}`;
            }

            const estado = obtenerValorConMapeo(fila, 'estado', mapeosDelCanal);
            const fechaReserva = obtenerValorConMapeo(fila, 'fechaReserva', mapeosDelCanal);
            // ... (resto de la lógica de obtención de valores y procesamiento se mantiene igual)
            
            // ... (resto del bucle)

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