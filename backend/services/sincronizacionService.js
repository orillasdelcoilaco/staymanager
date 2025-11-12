// backend/services/sincronizacionService.js

const admin = require('firebase-admin');
const xlsx = require('xlsx');
const { crearOActualizarCliente, recalcularEstadisticasClientes } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService');
const { obtenerValorDolar, actualizarValorDolarApi } = require('./dolarService');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { registrarCarga } = require('./historialCargasService');
const { calculatePrice } = require('./propuestasService');

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

const determinarEstado = (estadoCrudo, mapeosDeEstado) => {
    if (!estadoCrudo) return 'Desconocido';
    const estadoNormalizado = normalizarString(estadoCrudo);
    for (const [key, value] of Object.entries(mapeosDeEstado)) {
        if (normalizarString(key) === estadoNormalizado) {
            return value;
        }
    }
    return 'Desconocido';
};

const parsearMoneda = (valor, separadorDecimal = ',') => {
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

const procesarArchivoReservas = async (db, empresaId, canalId, bufferArchivo, nombreArchivoOriginal, usuarioEmail) => {
    await actualizarValorDolarApi(db, empresaId);

    const idCarga = await registrarCarga(db, empresaId, canalId, nombreArchivoOriginal, usuarioEmail);

    const rows = leerArchivo(bufferArchivo, nombreArchivoOriginal);
    if (rows.length < 2) {
        throw new Error("El archivo está vacío o no tiene filas de datos.");
    }
    
    const cabeceras = rows[0];
    const datosJson = rows.slice(1);

    const [conversionesAlojamiento, todosLosMapeos, canales, propiedades, tarifasSnapshot] = await Promise.all([
        obtenerConversionesPorEmpresa(db, empresaId),
        obtenerMapeosPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId),
        obtenerPropiedadesPorEmpresa(db, empresaId),
        db.collection('empresas').doc(empresaId).collection('tarifas').get()
    ]);
    
    const allTarifas = tarifasSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, fechaInicio: doc.data().fechaInicio.toDate(), fechaTermino: doc.data().fechaTermino.toDate() }));


    const mapeosDelCanal = todosLosMapeos.filter(m => m.canalId === canalId);
    if (mapeosDelCanal.length === 0) throw new Error("No se ha configurado un mapeo para este canal.");

    const canal = canales.find(c => c.id === canalId);
    if (!canal) throw new Error(`El canal con ID ${canalId} no fue encontrado.`);
    
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
        
        let idFilaParaError = `Fila ${index + 2}`;
        try {
            const idReservaCanal = get('idReservaCanal');
            if (idReservaCanal) idFilaParaError = idReservaCanal;

            const estadoCrudo = get('estado');
            const estadoFinal = determinarEstado(estadoCrudo, mapeosDeEstado);
            if (estadoFinal === 'Ignorar' || !idReservaCanal) {
                resultados.filasIgnoradas++;
                continue;
            }

            const fechaLlegadaCruda = get('fechaLlegada');
            let fechaLlegada = parsearFecha(fechaLlegadaCruda, formatoFecha);
            let fechaSalida = parsearFecha(get('fechaSalida'), formatoFecha);

            if (!fechaLlegada || !fechaSalida) throw new Error(`No se pudieron interpretar las fechas.`);
            if (fechaSalida <= fechaLlegada) throw new Error('La fecha de salida debe ser posterior a la de llegada.');
            
            const nombre = get('nombreCliente') || '';
            const apellido = get('apellidoCliente') || '';
            const nombreClienteCompleto = `${nombre} ${apellido}`.trim();
            
            let datosParaCliente = { 
                nombre: nombreClienteCompleto, 
                telefono: get('telefonoCliente'), 
                email: get('correoCliente'), 
                pais: get('pais') || 'CL',
                canalNombre: canalNombre,
                idReservaCanal: idReservaCanal
            };

            const resultadoCliente = await crearOActualizarCliente(db, empresaId, datosParaCliente);
            if (resultadoCliente.status === 'creado') resultados.clientesCreados++;
            
            const nombresExternosAlojamientos = (get('alojamientoNombre') || '').toString().split(',').map(s => s.trim()).filter(Boolean);
            if (nombresExternosAlojamientos.length === 0) {
                throw new Error("La columna de alojamiento está vacía o es inválida.");
            }
            
            const valorDolarDia = monedaCanal === 'USD' ? await obtenerValorDolar(db, empresaId, fechaLlegada) : null;

            const alojamientosDeReserva = [];
            for (const nombreExterno of nombresExternosAlojamientos) {
                const nombreExternoNormalizado = normalizarString(nombreExterno);
                const conversion = conversionesAlojamiento.find(c => c.canalId === canalId && c.nombreExterno.split(';').map(normalizarString).includes(nombreExternoNormalizado));
                if (!conversion) {
                    throw new Error(`No se encontró una conversión para el alojamiento "${nombreExterno}" en el canal ${canalNombre}.`);
                }
                const propiedad = propiedades.find(p => p.id === conversion.alojamientoId);
                if (!propiedad) {
                    throw new Error(`La propiedad interna con ID ${conversion.alojamientoId} no fue encontrada.`);
                }
                alojamientosDeReserva.push(propiedad);
            }
            
            for (const alojamiento of alojamientosDeReserva) {
                const proporcion = 1 / alojamientosDeReserva.length;

                // --- INICIO DE LA MODIFICACIÓN: Lógica de valores según TU fórmula ---

                // 1. Leer los valores del reporte tal como los mapeaste
                const valorAnfitrion_Orig = parsearMoneda(get('valorAnfitrion'), separadorDecimal) * proporcion; // (Payout) 356.4
                const comisionSumable_Orig = parsearMoneda(get('comision'), separadorDecimal) * proporcion;     // (Comisión sumable) 0
                const costoCanal_Informativo_Orig = parsearMoneda(get('costoCanal'), separadorDecimal) * proporcion; // (Informativo) 45.56
                // (Ya no leemos 'iva' del reporte, lo calculamos)

                // 2. Calcular el Subtotal (Payout + Comisión Sumable)
                const subtotal_Orig = valorAnfitrion_Orig + comisionSumable_Orig; // 356.4 + 0 = 356.4

                // 3. Determinar el IVA final y el Total Cliente
                let iva_Final_Orig;
                let valorHuesped_Final_Orig;

                if (configuracionIva === 'agregar') {
                    // Caso 1: "Agregar 19% de iva al total"
                    iva_Final_Orig = subtotal_Orig * 0.19; // 356.4 * 0.19 = 67.716
                    valorHuesped_Final_Orig = subtotal_Orig + iva_Final_Orig; // 356.4 + 67.716 = 424.116
                } else {
                    // Caso 2: "iva ya esta incluido en los montos"
                    valorHuesped_Final_Orig = subtotal_Orig; // Total Cliente = Subtotal
                    iva_Final_Orig = valorHuesped_Final_Orig / 1.19 * 0.19; // IVA (informativo)
                }
                // --- FIN DE LA MODIFICACIÓN ---

                // Calcular el precio base teórico para KPI
                const precioBaseTeorico = await calculatePrice(db, empresaId, [alojamiento], fechaLlegada, fechaSalida, allTarifas, canalId);
                const valorOriginalParaGuardar = precioBaseTeorico.totalPriceOriginal; // (KPI en USD)

                const convertirACLPSIesNecesario = (monto) => (monedaCanal === 'USD' && valorDolarDia) ? monto * valorDolarDia : monto;

                const totalNoches = Math.round((fechaSalida - fechaLlegada) / (1000 * 60 * 60 * 24));
                const idUnicoReserva = `${idReservaCanal}-${alojamiento.id}`;
                
                const datosReserva = {
                // ... (campos de id, fechas, cliente, etc. sin cambios) ...
                    empresaId, idUnicoReserva, idCarga, idReservaCanal: idReservaCanal.toString(), canalId, canalNombre,
                    estado: estadoFinal, estadoGestion: estadoFinal === 'Confirmada' ? 'Pendiente Bienvenida' : null,
                    fechaReserva: parsearFecha(get('fechaReserva'), formatoFecha), fechaLlegada, fechaSalida, totalNoches: totalNoches > 0 ? totalNoches : 1,
                    cantidadHuespedes: Math.ceil((parseInt(get('invitados')) || alojamiento.capacidad || 1) / alojamientosDeReserva.length),
                    clienteId: resultadoCliente.cliente.id, alojamientoId: alojamiento.id, alojamientoNombre: alojamiento.nombre,
                    moneda: monedaCanal,

                    // --- INICIO DE LA MODIFICACIÓN: Guardar todos los valores (Corregido) ---
                        valores: {
                        // --- Valores en CLP (Convertidos) ---
                        valorHuesped: Math.round(convertirACLPSIesNecesario(valorHuesped_Final_Orig)), // 424.12 -> CLP
                        valorTotal: Math.round(convertirACLPSIesNecesario(valorAnfitrion_Orig)), // 356.4 -> CLP
                        comision: Math.round(convertirACLPSIesNecesario(comisionSumable_Orig)), // 0 -> CLP
                        costoCanal: Math.round(convertirACLPSIesNecesario(costoCanal_Informativo_Orig)), // 45.56 -> CLP
                        iva: Math.round(convertirACLPSIesNecesario(iva_Final_Orig)), // 67.72 -> CLP
                        
                        // --- KPI (Precio Base) ---
                        valorOriginal: valorOriginalParaGuardar, // KPI (en USD)

                        // --- Valores Originales (Moneda Extranjera) ---
                        valorHuespedOriginal: valorHuesped_Final_Orig, // 424.12 USD
                        valorTotalOriginal: valorAnfitrion_Orig, // Payout (356.4 USD)
                        comisionOriginal: comisionSumable_Orig, // Comisión sumable (0 USD)
                        costoCanalOriginal: costoCanal_Informativo_Orig, // Costo info (45.56 USD)
                        ivaOriginal: iva_Final_Orig // IVA (67.72 USD)
                    },
                    // --- FIN DE LA MODIFICACIÓN ---

                    valorDolarDia, requiereActualizacionDolar: monedaCanal === 'USD' && fechaLlegada > today
              };
                
                const res = await crearOActualizarReserva(db, empresaId, datosReserva);
                if (res.status === 'creada') resultados.reservasCreadas++;
                else if (res.status === 'actualizada') resultados.reservasActualizadas++;
                else if (res.status === 'sin_cambios') resultados.reservasSinCambios++;
            }

        } catch (error) {
            console.error(`Error procesando fila ${idFilaParaError}:`, error);
            resultados.errores.push({ fila: idFilaParaError, error: error.message });
        }
    }

    recalcularEstadisticasClientes(db, empresaId).catch(err => {
        console.error(`[Background Job] Error al recalcular estadísticas para la empresa ${empresaId}:`, err);
    });

    return resultados;
};

module.exports = {
    procesarArchivoReservas,
    analizarCabeceras,
    analizarValoresUnicosColumna
};