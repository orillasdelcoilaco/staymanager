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

const parsearFecha = (fechaInput) => {
    console.log(`[FECHA] Iniciando parseo. Input: "${fechaInput}" (Tipo: ${typeof fechaInput})`);
    if (!fechaInput) {
        console.log('[FECHA] Input nulo o vacío, retornando null.');
        return null;
    }
    if (fechaInput instanceof Date) {
        console.log('[FECHA] El input ya es un objeto Date. Retornando directamente.');
        return fechaInput;
    }

    if (typeof fechaInput === 'number') {
        const fechaBase = new Date(Date.UTC(1899, 11, 30));
        fechaBase.setUTCDate(fechaBase.getUTCDate() + fechaInput);
        console.log(`[FECHA] Input es numérico (Excel). Convertido a: ${fechaBase.toISOString()}`);
        return fechaBase;
    }
    
    const fechaStr = fechaInput.toString().trim();
    
    // Intento 1: Formato D/M/YYYY o DD/MM/YYYY
    const matchLatino = fechaStr.match(/^(\d{1,2})[\\/.-](\d{1,2})[\\/.-](\d{4})/);
    if (matchLatino) {
        console.log('[FECHA] Detectado formato D/M/YYYY.');
        const dia = parseInt(matchLatino[1], 10);
        const mes = parseInt(matchLatino[2], 10) - 1; // Mes es 0-indexado
        const anio = parseInt(matchLatino[3], 10);
        const date = new Date(Date.UTC(anio, mes, dia));
        if (!isNaN(date.getTime())) {
            console.log(`[FECHA] Éxito con formato D/M/YYYY. Resultado: ${date.toISOString()}`);
            return date;
        } else {
            console.log('[FECHA] Falló la creación de fecha con formato D/M/YYYY a pesar del match.');
        }
    }

    // Intento 2: Parseo directo como fallback
    console.log('[FECHA] Intentando parseo directo...');
    const date = new Date(fechaStr);
    if (!isNaN(date.getTime())) {
        console.log(`[FECHA] Éxito con parseo directo. Resultado: ${date.toISOString()}`);
        return date;
    }

    console.log('[FECHA] FALLO TOTAL. No se pudo convertir el string a una fecha válida. Retornando null.');
    return null;
};


const normalizarString = (texto) => {
    if (!texto) return '';
    return texto
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
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
            const nombreExternoNormalizado = normalizarString(nombreExternoAlojamiento);

            if (nombreExternoNormalizado) {
                const conversionesDelCanal = conversionesAlojamiento.filter(c => c.canalId === canalId);
                
                let conversionEncontrada = null;
                for (const conversion of conversionesDelCanal) {
                    const posiblesNombres = conversion.nombreExterno.split(';').map(nombre => normalizarString(nombre));
                    if (posiblesNombres.includes(nombreExternoNormalizado)) {
                        conversionEncontrada = conversion;
                        break;
                    }
                }

                if (conversionEncontrada) {
                    alojamientoId = conversionEncontrada.alojamientoId;
                    alojamientoNombre = conversionEncontrada.alojamientoNombre;
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