const xlsx = require('xlsx');
const { crearOActualizarCliente } = require('./clientesService');
const { crearOActualizarReserva } = require('./reservasService');
const { obtenerConversionesPorEmpresa } = require('./conversionesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { obtenerMapeosPorEmpresa } = require('./mapeosService');
const { obtenerValorDolar } = require('./dolarService');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');

const leerArchivo = (buffer, nombreArchivo) => {
    // Al pasar el buffer directamente, la librería xlsx se encarga de la detección de formato y codificación.
    // Se mantiene cellDates para asegurar que las fechas se interpreten como objetos Date siempre que sea posible.
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // header: 1 para obtener un array de arrays, raw: false para obtener valores formateados.
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

const parsearFecha = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date && !isNaN(dateValue)) {
        return dateValue;
    }
    if (typeof dateValue === 'number') {
        const date = new Date(Date.UTC(1899, 11, 30, 0, 0, 0, 0) + dateValue * 86400000);
        return date;
    }
    if (typeof dateValue !== 'string') {
        return null;
    }

    const dateStr = dateValue.trim();
    const match = dateStr.match(/^(\d{1,2})[\\/.-](\d{1,2})[\\/.-](\d{2,4})/);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;

        // Se crea la fecha asumiendo siempre el formato DD/MM/YYYY
        const date = new Date(Date.UTC(year, month - 1, day));
        
        // Se valida que la fecha creada sea coherente (ej: no es 31 de febrero)
        if (date && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
            return date;
        }
    }

    // Fallback para otros formatos si el regex principal falla
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
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

            const fechaLlegada = parsearFecha(get('fechaLlegada'));
            const fechaSalida = parsearFecha(get('fechaSalida'));

            if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada) {
                resultados.errores.push({ fila: idFilaParaError, error: 'Fechas de llegada o salida inválidas.' });
                continue;
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
            
            // --- INICIO DE LOGS DE DEPURACIÓN ---
            const nombreExternoAlojamiento = get('alojamientoNombre');
            console.log(`\n--- [DEBUG] Fila ${index + 2} (ID Reserva: ${idFilaParaError}) ---`);
            console.log(`[DEBUG] 1. Nombre Alojamiento leído del archivo: "${nombreExternoAlojamiento}"`);

            let alojamientoId = null;
            let alojamientoNombre = 'Alojamiento no identificado';
            let capacidadAlojamiento = 0;
            const nombreExternoNormalizado = normalizarString(nombreExternoAlojamiento);
            console.log(`[DEBUG] 2. Nombre normalizado del archivo: "${nombreExternoNormalizado}"`);

            if (nombreExternoNormalizado) {
                const conversionesDelCanal = conversionesAlojamiento.filter(c => c.canalId === canalId);
                console.log(`[DEBUG] 3. Buscando en ${conversionesDelCanal.length} regla(s) de conversión para el canal "${canalNombre}":`);
                conversionesDelCanal.forEach(regla => {
                    console.log(`   - Regla para "${regla.alojamientoNombre}" espera los nombres normalizados: [${regla.nombreExterno.split(';').map(normalizarString).join(', ')}]`);
                });

                const conversion = conversionesDelCanal.find(c => 
                    c.nombreExterno.split(';').map(normalizarString).includes(nombreExternoNormalizado)
                );

                if (conversion) {
                    console.log(`[DEBUG] 4. ¡ÉXITO! Se encontró coincidencia con la regla para "${conversion.alojamientoNombre}".`);
                    alojamientoId = conversion.alojamientoId;
                    alojamientoNombre = conversion.alojamientoNombre;
                    const propiedad = propiedades.find(p => p.id === alojamientoId);
                    if (propiedad) capacidadAlojamiento = propiedad.capacidad;
                } else {
                    console.log(`[DEBUG] 4. ¡FALLO! No se encontró ninguna regla de conversión que coincida.`);
                }
            } else {
                console.log(`[DEBUG] 3. El nombre del alojamiento en el archivo está vacío o no se pudo mapear. Saltando búsqueda.`);
            }

            console.log(`[DEBUG] 5. Alojamiento asignado finalmente: ID="${alojamientoId}", Nombre="${alojamientoNombre}"`);
            console.log(`--------------------------------------------------`);
            // --- FIN DE LOGS DE DEPURACIÓN ---

            let valorTotal = parseFloat(get('valorTotal')?.toString().replace(/[^0-9.,$]+/g, "").replace(',', '.')) || 0;
            if (monedaCanal === 'USD') {
                const valorDolarDia = await obtenerValorDolar(fechaLlegada);
                valorTotal = valorTotal * valorDolarDia;
            }

            const totalNoches = Math.round((fechaSalida - fechaLlegada) / (1000 * 60 * 60 * 24));

            const datosReserva = {
                idReservaCanal: idReservaCanal.toString(), canalId, canalNombre,
                estado: normalizarEstado(get('estado')),
                fechaReserva: parsearFecha(get('fechaReserva')),
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