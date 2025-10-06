// backend/services/mensajeService.js

const { obtenerPlantillasPorEmpresa, obtenerTiposPlantilla } = require('./plantillasService');
const { obtenerDetallesEmpresa } = require('./empresaService');
const { getActividadDiaria, getDisponibilidadPeriodo } = require('./reportesService');

const prepararMensaje = async (db, empresaId, grupoReserva, tipoMensaje) => {
    const [todasLasPlantillas, todosLosTipos] = await Promise.all([
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerTiposPlantilla(db, empresaId)
    ]);

    const tipo = todosLosTipos.find(t => t.nombre.toLowerCase().includes(tipoMensaje.toLowerCase()));
    if (!tipo) {
        if (tipoMensaje.toLowerCase() === 'salida') {
            const tipoDespedida = todosLosTipos.find(t => t.nombre.toLowerCase().includes('despedida'));
            if (tipoDespedida) {
                const plantillasFiltradas = todasLasPlantillas.filter(p => p.tipoId === tipoDespedida.id);
                return { plantillas: plantillasFiltradas, datosReserva: grupoReserva };
            }
        }
        throw new Error(`No se encontró un tipo de plantilla para '${tipoMensaje}'.`);
    }

    const plantillasFiltradas = todasLasPlantillas.filter(p => p.tipoId === tipo.id);
    
    return {
        plantillas: plantillasFiltradas,
        datosReserva: grupoReserva 
    };
};

const generarTextoPropuesta = async (db, empresaId, datosPropuesta) => {
    const { cliente, propiedades, fechaLlegada, fechaSalida, personas, noches, precioFinal, idPropuesta, precioListaCLP, descuentoCLP, pricingDetails, moneda, valorDolarDia } = datosPropuesta;

    const [plantillas, tipos, empresaData] = await Promise.all([
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerTiposPlantilla(db, empresaId),
        obtenerDetallesEmpresa(db, empresaId)
    ]);

    const tipoPropuesta = tipos.find(t => t.nombre.toLowerCase().includes('propuesta'));
    if (!tipoPropuesta) throw new Error('No se encontró un "Tipo de Plantilla" llamado "Propuesta".');

    const plantilla = plantillas.find(p => p.tipoId === tipoPropuesta.id);
    if (!plantilla) throw new Error('No se encontró ninguna plantilla de tipo "Propuesta".');

    let texto = plantilla.texto;

    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
    const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

    let detallePropiedades = propiedades.map(prop => {
        let detalle = `Cabaña ${prop.nombre}: `;
        const detalles = [];
        if (prop.camas?.matrimoniales) detalles.push(`* ${prop.camas.matrimoniales} dormitorio(s) matrimoniales${prop.equipamiento?.piezaEnSuite ? ' (uno en suite)' : ''}.`);
        if (prop.camas?.camarotes) detalles.push(`* ${prop.camas.camarotes} camarote(s).`);
        if (prop.numBanos) detalles.push(`* ${prop.numBanos} baño(s) completo(s).`);
        if (prop.descripcion) detalles.push(`* ${prop.descripcion}`);
        if (prop.equipamiento?.terrazaTechada) detalles.push(`* Terraza techada.`);
        if (prop.equipamiento?.tinaja) detalles.push(`* Tinaja privada.`);
        if (prop.equipamiento?.parrilla) detalles.push(`* Parrilla.`);
        if (prop.linkFotos) detalles.push(`📸 Fotos y más información: ${prop.linkFotos}`);
        return detalle + '\n' + detalles.join('\n');
    }).join('\n\n');

    let resumenValores = `📊 Detalle por Alojamiento (${noches} Noches)\n----------------------------------\n`;
    resumenValores += propiedades.map(prop => {
        const precioDetalle = pricingDetails.find(d => d.nombre === prop.nombre);
        if (!precioDetalle) return `${prop.nombre}: $0`;
        
        const precioDetalleOriginal = precioDetalle.precioTotal;
        const precioDetalleCLP = moneda === 'USD' ? Math.round(precioDetalleOriginal * valorDolarDia) : precioDetalleOriginal;
        return `${prop.nombre}: ${formatCurrency(precioDetalleCLP)}`;
    }).join('\n');
    
    resumenValores += `\n\n📈 Totales Generales\n----------------------------------\n`;
    resumenValores += `Subtotal: ${formatCurrency(precioListaCLP)}\n`;
    if (descuentoCLP > 0) {
        resumenValores += `Descuento Aplicado: -${formatCurrency(descuentoCLP)}\n`;
    }
    resumenValores += `----------------------------------\n`;
    resumenValores += `*TOTAL A PAGAR: ${formatCurrency(precioFinal)}* (IVA incluido)`;

    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
    const fechaVencimientoStr = fechaVencimiento.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + " a las 23:59 hrs";
    
    const porcentajeAbono = 10;
    const montoAbono = precioFinal * (porcentajeAbono / 100);

    const reemplazos = {
        '[PROPUESTA_ID]': `APP-${idPropuesta.substring(0, 15)}`,
        '[FECHA_EMISION]': new Date().toLocaleDateString('es-CL'),
        '[CLIENTE_NOMBRE]': cliente.nombre,
        '[FECHAS_ESTADIA_TEXTO]': `${formatDate(fechaLlegada)} al ${formatDate(fechaSalida)}`,
        '[TOTAL_NOCHES]': noches,
        '[GRUPO_SOLICITADO]': personas,
        '[DETALLE_PROPIEDADES_PROPUESTA]': detallePropiedades,
        '[RESUMEN_VALORES_PROPUESTA]': resumenValores,
        '[FECHA_VENCIMIENTO_PROPUESTA]': fechaVencimientoStr,
        '[PORCENTAJE_ABONO]': `${porcentajeAbono}%`,
        '[MONTO_ABONO]': formatCurrency(montoAbono),
        '[USUARIO_NOMBRE]': empresaData.contactoNombre || '',
        '[USUARIO_TELEFONO]': empresaData.contactoTelefono || '',
        '[EMPRESA_WEBSITE]': empresaData.website || '',
    };
    
    for (const [etiqueta, valor] of Object.entries(reemplazos)) {
        texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor);
    }

    return texto;
};

const generarTextoReporte = async (db, empresaId, tipoReporte, datos) => {
    console.log(`[Debug MensajeService] Iniciando generarTextoReporte. Tipo: ${tipoReporte}, Datos:`, datos);

    const [plantillas, tipos] = await Promise.all([
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerTiposPlantilla(db, empresaId)
    ]);
    
    const tipo = tipos.find(t => t.nombre.toLowerCase().includes(tipoReporte.toLowerCase()));
    if (!tipo) {
        console.error(`[Debug MensajeService] No se encontró tipo de plantilla para: ${tipoReporte}`);
        throw new Error(`No se encontró un tipo de plantilla para '${tipoReporte}'.`);
    }

    const plantilla = plantillas.find(p => p.tipoId === tipo.id);
    if (!plantilla) {
        console.error(`[Debug MensajeService] No se encontró plantilla para el tipo: ${tipo.nombre}`);
        throw new Error(`No se encontró ninguna plantilla de tipo '${tipoReporte}'.`);
    }
    
    console.log('[Debug MensajeService] Plantilla encontrada:', plantilla.nombre);
    let texto = plantilla.texto;
    console.log('[Debug MensajeService] Texto original de la plantilla:\n---', texto, '\n---');
    
    let reporteGenerado = '';
    const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' });
    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

    if (tipoReporte === 'actividad_diaria') {
        const dataReporte = await getActividadDiaria(db, empresaId, datos.fecha);
        dataReporte.forEach(item => {
            reporteGenerado += `🏡 Cabaña ${item.nombre}\n`;
            if (item.salida) reporteGenerado += `👋 Se retira hoy: ${item.salida.cliente}\nFechas: ${item.salida.fechas}\nReserva: ${item.salida.reservaId}\n`;
            if (item.llegada) reporteGenerado += `🧑‍🤝‍🧑 Llega hoy: ${item.llegada.cliente}\nFechas: ${item.llegada.fechas}\nReserva: ${item.llegada.reservaId}\nCanal: ${item.llegada.canal}\n`;
            else if (item.estadia) reporteGenerado += `💤 En estadía: ${item.estadia.cliente}\nReserva: ${item.estadia.reservaId}\nFechas: ${item.estadia.fechas}\n`;
            else if (item.proxima) reporteGenerado += `🔜 Próxima reserva: ${item.proxima.fecha}\n(Faltan ${item.proxima.diasFaltantes} días)\nLlega: ${item.proxima.cliente}\n`;
            else if (!item.salida) reporteGenerado += `❌ Sin reserva hoy\n`;
            reporteGenerado += `\n`;
        });
        texto = texto.replace(/\[FECHA_REPORTE\]/g, formatDate(datos.fecha));
        texto = texto.replace(/\[REPORTE_ACTIVIDAD_DIARIA\]/g, reporteGenerado.trim());
    }

    if (tipoReporte === 'disponibilidad') {
        const dataReporte = await getDisponibilidadPeriodo(db, empresaId, datos.fechaInicio, datos.fechaFin);
        dataReporte.forEach(item => {
            if (item.periodos.length > 0) {
                reporteGenerado += `🏡 Cabaña ${item.nombre}:\n`;
                if(item.link) reporteGenerado += `${item.link}\n`;
                if(item.valor > 0) reporteGenerado += `Valor: ${formatCurrency(item.valor)}\n`;
                if(item.capacidad > 0) reporteGenerado += `Capacidad: ${item.capacidad} personas\n`;

                item.periodos.forEach(p => {
                    const finDate = new Date(p.fin + 'T00:00:00Z');
                    finDate.setUTCDate(finDate.getUTCDate()); 
                    if(new Date(p.inicio) < finDate) {
                       reporteGenerado += `👍 Del ${formatDate(p.inicio)} al ${formatDate(finDate.toISOString().split('T')[0])}\n`;
                    }
                });
                reporteGenerado += `\n`;
            }
        });
        texto = texto.replace(/\[FECHA_INICIO_REPORTE\]/g, formatDate(datos.fechaInicio));
        texto = texto.replace(/\[FECHA_FIN_REPORTE\]/g, formatDate(datos.fechaFin));
        texto = texto.replace(/\[REPORTE_DISPONIBILIDAD\]/g, reporteGenerado.trim());
    }
    
    console.log('[Debug MensajeService] Contenido del reporte generado:\n---', reporteGenerado, '\n---');
    console.log('[Debug MensajeService] Texto final después de reemplazos:\n---', texto, '\n---');
    return texto;
};


module.exports = {
    prepararMensaje,
    generarTextoPropuesta,
    generarTextoReporte
};