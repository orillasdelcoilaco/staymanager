const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService');
const { obtenerValorDolar } = require('./dolarService');

const leerArchivo = (buffer, nombreArchivo) => {
    const esCsv = nombreArchivo && nombreArchivo.toLowerCase().endsWith('.csv');
    // Para CSVs con caracteres latinos, usamos decodificación 'latin1' (Windows-1252)
    const opcionesLectura = esCsv 
        ? { type: buffer.toString('latin1').startsWith('"') ? 'string' : 'buffer', codepage: 1252 } 
        : { type: 'buffer' };
    
    const data = esCsv && opcionesLectura.type === 'string' ? buffer.toString('latin1') : buffer;
    
    const workbook = xlsx.read(data, { ...opcionesLectura, cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
};

const analizarCabeceras = async (buffer, nombreArchivo) => {
    const rows = leerArchivo(buffer, nombreArchivo);
    return rows.length > 0 ? rows[0].filter(Boolean) : []; // Devuelve la primera fila (cabeceras)
};

const obtenerValorConMapeo = (fila, campoInterno, mapeosDelCanal, cabeceras) => {
    const mapeo = mapeosDelCanal.find(m => m.campoInterno === campoInterno);
    if (!mapeo || !mapeo.nombresExternos || mapeo.nombresExternos.length === 0) return undefined;
    
    const nombreExterno = mapeo.nombresExternos[0];
    const index = cabeceras.indexOf(nombreExterno);

    return index !== -1 ? fila[index] : undefined;
};

const parsearFecha = (dateValue) => {
    console.log(`[parsearFecha] Recibido valor crudo: '${dateValue}' (Tipo: ${typeof dateValue})`);
    if (!dateValue) return null;
    if (dateValue instanceof Date && !isNaN(dateValue)) {
        console.log(`[parsearFecha] Es una instancia de Date válida. Retornando: ${dateValue.toISOString()}`);
        return dateValue;
    }
    if (typeof dateValue === 'number') {
        const date = new Date(Date.UTC(1899, 11, 30, 0, 0, 0, 0) + dateValue * 86400000);
        console.log(`[parsearFecha] Es un número (Excel). Convertido a: ${date.toISOString()}`);
        return date;
    }
    if (typeof dateValue !== 'string') {
        console.log(`[parsearFecha] No es un string válido. Retornando null.`);
        return null;
    }
    
    const dateStr = dateValue.trim();
    let date;

    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        date = new Date(dateStr.substring(0, 10) + 'T00:00:00Z');
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    } else {
        date = new Date(dateStr);
    }

    if (!isNaN(date)) {
        console.log(`[parsearFecha] Parseo exitoso. Fecha resultante: ${date.toISOString()}`);
        return date;
    }
    
    console.log(`[parsearFecha] No se pudo parsear la fecha. Retornando null.`);
    return null;
}


const normalizarString = (texto) => {
    if (!texto) return '';
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, ' ');
};

const procesarArchivoReservas = async (db, empresaId, canalId, bufferArchivo, nombreArchivoOriginal = '') => {
    const rows = leerArchivo(bufferArchivo, nombreArchivoOriginal);
    if (rows.length < 2) {
        throw new Error("El archivo está vacío o no tiene filas de datos.");
    }
    
    const cabeceras = rows[0];
    const datosJson = rows.slice(1);

    const conversionesAlojamiento = await obtenerConversionesPorEmpresa(db, empresaId);
    const todosLosMapeos = await obtenerMapeosPorEmpresa(db, empresaId);
    const valorDolarHoy = await obtenerValorDolar(new Date());

    const mapeosDelCanal = todosLosMapeos.filter(m => m.canalId === canalId);
    const canal = (await obtenerCanalesPorEmpresa(db, empresaId)).find(c => c.id === canalId);
    const canalNombre = canal ? canal.nombre : 'Canal Desconocido';
    
    let resultados = { totalFilas: datosJson.length, reservasCreadas: 0, reservasActualizadas: 0, reservasSinCambios: 0, clientesCreados: 0, filasIgnoradas: 0, errores: [] };

    for (const [index, filaArray] of datosJson.entries()) {
        let idFilaParaError = `Fila ${index + 2}`;
        try {
            const get = (campo) => obtenerValorConMapeo(filaArray, campo, mapeosDelCanal, cabeceras);

            const idReservaCanal = get('idReservaCanal');
            if (idReservaCanal) idFilaParaError = idReservaCanal;

            const tipoFila = get('tipoFila');
            if ((tipoFila && tipoFila.toLowerCase().indexOf('reserv') === -1) || !idReservaCanal) {
                resultados.filasIgnoradas++;
                continue;
            }

            const nombreCliente = get('nombreCliente');
            const telefonoCliente = get('telefonoCliente');
            const correoCliente = get('correoCliente');
            const pais = get('pais');
            let datosParaCliente = { nombre: nombreCliente, telefono: telefonoCliente, email: correoCliente, pais };
            if (!telefonoCliente) {
                const nombreBase = nombreCliente || 'Huésped';
                datosParaCliente.nombre = `${nombreBase} - ${idReservaCanal} - ${canalNombre}`;
                datosParaCliente.idCompuesto = `${nombreBase}-${idReservaCanal}-${canalNombre}`.replace(/\s+/g, '-').toLowerCase();
            }
            const resultadoCliente = await crearOActualizarCliente(db, empresaId, datosParaCliente);
            if (resultadoCliente.status === 'creado') resultados.clientesCreados++;

            const nombreExternoAlojamiento = get('alojamientoNombre');
            let alojamientoId = null;
            let alojamientoNombre = 'Alojamiento no identificado';
            const nombreExternoNormalizado = normalizarString(nombreExternoAlojamiento);
            if (nombreExternoNormalizado) {
                const conversion = conversionesAlojamiento.find(c => c.canalId === canalId && c.nombreExterno.split(';').map(normalizarString).includes(nombreExternoNormalizado));
                if (conversion) {
                    alojamientoId = conversion.alojamientoId;
                    alojamientoNombre = conversion.alojamientoNombre;
                }
            }

            const valorTotalCrudo = get('valorTotal');
            const moneda = valorTotalCrudo?.toString().toUpperCase().includes('USD') ? 'USD' : 'CLP';
            let valorTotal = 0;
            if (valorTotalCrudo) {
                const valorNumerico = parseFloat(valorTotalCrudo.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.'));
                valorTotal = moneda === 'USD' ? valorNumerico * valorDolarHoy : valorNumerico;
            }
            
            console.log(`--- Procesando Fila ${index + 2} (Reserva: ${idReservaCanal}) ---`);
            const fechaLlegadaCruda = get('fechaLlegada');
            const fechaSalidaCruda = get('fechaSalida');
            console.log(`Valor crudo para fechaLlegada: '${fechaLlegadaCruda}'`);
            console.log(`Valor crudo para fechaSalida: '${fechaSalidaCruda}'`);


            const datosReserva = {
                idReservaCanal: idReservaCanal.toString(), canalId, canalNombre,
                estado: get('estado') || 'Pendiente',
                fechaReserva: parsearFecha(get('fechaReserva')),
                fechaLlegada: parsearFecha(fechaLlegadaCruda),
                fechaSalida: parsearFecha(fechaSalidaCruda),
                totalNoches: parseInt(get('totalNoches')) || 0,
                cantidadHuespedes: parseInt(get('invitados')) || 0,
                clienteId: resultadoCliente.cliente.id,
                alojamientoId, alojamientoNombre, moneda,
                valores: {
                    valorTotal,
                    comision: parseFloat(get('comision')?.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.')) || 0,
                    abono: parseFloat(get('abono')) || 0,
                    pendiente: parseFloat(get('pendiente')) || 0
                },
            };
            
            if (!datosReserva.fechaLlegada || !datosReserva.fechaSalida) {
                console.error(`Error de fecha en fila ${index + 2}: Llegada o Salida inválida. Saltando...`);
                resultados.errores.push({ fila: idFilaParaError, error: 'Fecha de llegada o salida no pudo ser interpretada.' });
                continue; // Saltar esta fila
            }

            
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