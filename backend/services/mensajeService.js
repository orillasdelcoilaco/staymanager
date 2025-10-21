// backend/services/mensajeService.js

const { obtenerPlantillasPorEmpresa, obtenerTiposPlantilla } = require('./plantillasService');
const { obtenerDetallesEmpresa } = require('./empresaService');
const { getActividadDiaria, getDisponibilidadPeriodo } = require('./reportesService');
const { obtenerPropiedadPorId } = require('./propiedadesService'); // Necesario para obtenerImagenPrincipal
const { calculatePrice } = require('./propuestasService'); // Necesario para generarTextoPresupuesto
const { obtenerValorDolarHoy } = require('./dolarService'); // Necesario para generarTextoPresupuesto
const { format } = require('date-fns'); // Necesario para generarTextoPresupuesto
const es = require('date-fns/locale/es'); // Necesario para generarTextoPresupuesto en español

// Función auxiliar para obtener la imagen principal (movida aquí si es necesario)
function obtenerImagenPrincipal(propiedad) {
    if (propiedad.websiteData && propiedad.websiteData.images) {
        const imagenes = propiedad.websiteData.images;
        const portada = imagenes['portadaRecinto']?.[0] || imagenes['exteriorAlojamiento']?.[0];
        if (portada) return portada.storagePath;
        const allImages = Object.values(imagenes).flat();
        if (allImages.length > 0) return allImages[0].storagePath;
    }
    return 'https://via.placeholder.com/400x300.png?text=Imagen+no+disponible';
}

const prepararMensaje = async (db, empresaId, grupoReserva, tipoMensaje) => {
    const [todasLasPlantillas, todosLosTipos] = await Promise.all([
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerTiposPlantilla(db, empresaId)
    ]);

    const tipo = todosLosTipos.find(t => t.nombre.toLowerCase().includes(tipoMensaje.toLowerCase()));
    if (!tipo) {
        // Fallback para 'salida' -> 'despedida'
        if (tipoMensaje.toLowerCase() === 'salida') {
            const tipoDespedida = todosLosTipos.find(t => t.nombre.toLowerCase().includes('despedida'));
            if (tipoDespedida) {
                const plantillasFiltradas = todasLasPlantillas.filter(p => p.tipoId === tipoDespedida.id);
                 // Asegurarse que datosReserva exista, aunque esté vacío si no hay grupoReserva
                return { plantillas: plantillasFiltradas, datosReserva: grupoReserva || {} };
            }
        }
        throw new Error(`No se encontró un tipo de plantilla para '${tipoMensaje}'.`);
    }

    const plantillasFiltradas = todasLasPlantillas.filter(p => p.tipoId === tipo.id);

    return {
        plantillas: plantillasFiltradas,
        datosReserva: grupoReserva || {} // Asegurar que datosReserva exista
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
        if (prop.camas?.plazaYMedia) detalles.push(`* ${prop.camas.plazaYMedia} cama(s) de 1.5 plazas.`); // Añadido
        if (prop.camas?.camarotes) detalles.push(`* ${prop.camas.camarotes} camarote(s).`);
        if (prop.numBanos) detalles.push(`* ${prop.numBanos} baño(s) completo(s).`);

        // Usar descripción optimizada si existe, si no la manual
        const descripcionMostrar = prop.websiteData?.aiDescription || prop.descripcion;
        if (descripcionMostrar) detalles.push(`* ${descripcionMostrar}`);

        if (prop.equipamiento?.terrazaTechada) detalles.push(`* Terraza techada.`);
        if (prop.equipamiento?.tinaja) detalles.push(`* Tinaja privada.`);
        if (prop.equipamiento?.parrilla) detalles.push(`* Parrilla.`);

        // Usar la nueva lógica para obtener imagen principal
        const imagenUrl = obtenerImagenPrincipal(prop);
        // Evitar añadir enlace si es el placeholder
        if (imagenUrl && !imagenUrl.includes('via.placeholder.com')) {
             detalles.push(`📸 Fotos: ${imagenUrl}`); // O un enlace a la página /propiedad/id
        }
        return detalle + '\n' + detalles.join('\n');
    }).join('\n\n');


    let resumenValores = `📊 Detalle por Alojamiento (${noches} Noches)\n----------------------------------\n`;
    resumenValores += propiedades.map(prop => {
        // pricingDetails ahora tiene el precio en la moneda objetivo
        const precioDetalle = pricingDetails.find(d => d.nombre === prop.nombre);
        if (!precioDetalle) return `${prop.nombre}: $0`;

        const precioTotalPropEnMonedaObjetivo = precioDetalle.precioTotal;
        const precioTotalPropEnCLP = moneda === 'USD'
            ? Math.round(precioTotalPropEnMonedaObjetivo * valorDolarDia)
            : precioTotalPropEnMonedaObjetivo;

        return `${prop.nombre}: ${formatCurrency(precioTotalPropEnCLP)}`;
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

    const porcentajeAbono = 10; // Podría ser configurable por empresa
    const montoAbono = precioFinal * (porcentajeAbono / 100);

    const reemplazos = {
        '[PROPUESTA_ID]': `APP-${(idPropuesta || '').substring(0, 15)}`, // Asegurar que idPropuesta exista
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
        '[EMPRESA_NOMBRE]': empresaData.nombre || '', // Añadido
        '[CONDICIONES_RESERVA]': empresaData.condicionesReserva || '', // Añadido
    };

    for (const [etiqueta, valor] of Object.entries(reemplazos)) {
        // Usar global flag 'g' para reemplazar todas las ocurrencias
        texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor !== undefined && valor !== null ? valor : '');
    }

    return texto;
};


// *** INICIO: LÓGICA DE generarTextoPresupuesto ***
const generarTextoPresupuesto = async (db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades, personas) => {
    const [tipos, plantillas, empresaData, dolarHoy, canalesSnapshot] = await Promise.all([
        obtenerTiposPlantilla(db, empresaId),
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerDetallesEmpresa(db, empresaId),
        obtenerValorDolarHoy(db, empresaId), // Necesitamos el dólar
        db.collection('empresas').doc(empresaId).collection('canales').get() // Necesitamos los canales
    ]);

    const tipoPresupuesto = tipos.find(t => t.nombre.toLowerCase().includes('presupuesto'));
    if (!tipoPresupuesto) {
        throw new Error('No se encontró un "Tipo de Plantilla" llamado "Presupuesto".');
    }

    const plantilla = plantillas.find(p => p.tipoId === tipoPresupuesto.id);
    if (!plantilla) {
        throw new Error('No se encontró ninguna plantilla de tipo "Presupuesto".');
    }

    let texto = plantilla.texto;

    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
    const formatDate = (dateString) => {
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
    };


    const startDate = new Date(fechaLlegada + 'T00:00:00Z');
    const endDate = new Date(fechaSalida + 'T00:00:00Z');
    const noches = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Necesitamos obtener las tarifas para calcular el precio
    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
     const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
        const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
        return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
    });


    // Necesitamos el canal por defecto o 'App' para calculatePrice
    const allCanales = canalesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const canalParaCalculo = allCanales.find(c => c.nombre.toLowerCase() === 'app') || allCanales.find(c => c.esCanalPorDefecto);
    if (!canalParaCalculo) {
        throw new Error("Se requiere un canal 'App' o un canal por defecto para calcular precios.");
    }

    const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, canalParaCalculo.id, dolarHoy.valor);

    let detalleCabañas = '';
    for (const prop of propiedades) {
        // Buscar detalles de precio para esta propiedad
        const precioDetalle = pricing.details.find(d => d.nombre === prop.nombre);
        
        // CORRECCIÓN: Usar precioTotalCLP del objeto pricing, no del detalle (que está en moneda objetivo)
        const precioTotalCLP = precioDetalle ? Math.round(pricing.totalPriceCLP / propiedades.length) : 0; // Asumir distribución equitativa
        const precioNocheCLP = noches > 0 ? Math.round(precioTotalCLP / noches) : 0;

        // Obtener datos completos de la propiedad (si no vienen en el array 'propiedades')
        const propData = await obtenerPropiedadPorId(db, empresaId, prop.id);
        const imagenUrl = propData ? obtenerImagenPrincipal(propData) : 'https://via.placeholder.com/400x300.png?text=Imagen+no+disponible';

        detalleCabañas += `🔹 Cabaña ${prop.nombre} (Capacidad: ${prop.capacidad} personas)\n`;
        // Añadir detalles de camas y baños si existen en propData
         if (propData?.camas) {
            if (propData.camas.matrimoniales) detalleCabañas += `* ${propData.camas.matrimoniales} dorm. matrimonial(es).\n`;
            if (propData.camas.plazaYMedia) detalleCabañas += `* ${propData.camas.plazaYMedia} cama(s) 1.5 plz.\n`;
            if (propData.camas.camarotes) detalleCabañas += `* ${propData.camas.camarotes} camarote(s).\n`;
        }
        if (propData?.numBanos) detalleCabañas += `* ${propData.numBanos} baño(s).\n`;
        // Añadir equipamiento
        if (propData?.equipamiento) {
             if (propData.equipamiento.tinaja) detalleCabañas += `* Tinaja privada.\n`;
             if (propData.equipamiento.parrilla) detalleCabañas += `* Parrilla.\n`;
             // ... otros equipamientos
        }

        if (imagenUrl && !imagenUrl.includes('via.placeholder.com')) {
             detalleCabañas += `📷 Ver fotos: ${imagenUrl}\n`;
        }
        detalleCabañas += `💵 Valor por noche: ${formatCurrency(precioNocheCLP)}\n`;
        detalleCabañas += `💵 Total por ${noches} noches: ${formatCurrency(precioTotalCLP)}\n\n`;
    }

    const reemplazos = {
        '[CLIENTE_NOMBRE]': cliente.nombre,
        '[CLIENTE_EMPRESA]': cliente.empresa || '', // Asegurar que exista o sea vacío
        '[FECHA_EMISION]': new Date().toLocaleDateString('es-CL'),
        '[FECHA_LLEGADA]': formatDate(fechaLlegada),
        '[FECHA_SALIDA]': formatDate(fechaSalida),
        '[TOTAL_DIAS]': noches + 1,
        '[TOTAL_NOCHES]': noches,
        '[GRUPO_SOLICITADO]': personas,
        '[LISTA_DE_CABANAS]': detalleCabañas.trim(),
        '[TOTAL_GENERAL]': formatCurrency(pricing.totalPriceCLP),
        '[RESUMEN_CANTIDAD_CABANAS]': propiedades.length,
        '[RESUMEN_CAPACIDAD_TOTAL]': propiedades.reduce((sum, p) => sum + (p.capacidad || 0), 0), // Sumar capacidad
        '[EMPRESA_NOMBRE]': empresaData.nombre || '',
        '[EMPRESA_SLOGAN]': empresaData.slogan || '',
        '[SERVICIOS_GENERALES]': empresaData.serviciosGenerales || '',
        '[CONDICIONES_RESERVA]': empresaData.condicionesReserva || '',
        '[EMPRESA_UBICACION_TEXTO]': empresaData.ubicacionTexto || '',
        '[EMPRESA_GOOGLE_MAPS_LINK]': empresaData.googleMapsLink || '',
        '[USUARIO_NOMBRE]': empresaData.contactoNombre || '',
        '[USUARIO_EMAIL]': empresaData.contactoEmail || '',
        '[USUARIO_TELEFONO]': empresaData.contactoTelefono || '',
        '[EMPRESA_WEBSITE]': empresaData.website || '',
    };

    for (const [etiqueta, valor] of Object.entries(reemplazos)) {
         texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor !== undefined && valor !== null ? valor : '');
    }

    return texto;
};
// *** FIN: LÓGICA DE generarTextoPresupuesto ***


const generarTextoReporte = async (db, empresaId, tipoReporte, datos) => {
    const [plantillas, tipos] = await Promise.all([
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerTiposPlantilla(db, empresaId)
    ]);

    const tipo = tipos.find(t => t.nombre.toLowerCase().includes(tipoReporte.toLowerCase()));
    if (!tipo) throw new Error(`No se encontró un tipo de plantilla para '${tipoReporte}'.`);

    const plantilla = plantillas.find(p => p.tipoId === tipo.id);
    if (!plantilla) throw new Error(`No se encontró ninguna plantilla de tipo '${tipoReporte}'.`);

    let texto = plantilla.texto;
    let reporteGenerado = '';
    const formatDateRep = (dateStr) => new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' });
    const formatCurrencyRep = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

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
        texto = texto.replace(/\[FECHA_REPORTE\]/g, formatDateRep(datos.fecha));
        texto = texto.replace(/\[REPORTE_ACTIVIDAD_DIARIA\]/g, reporteGenerado.trim());
    }

    if (tipoReporte === 'disponibilidad') {
        const dataReporte = await getDisponibilidadPeriodo(db, empresaId, datos.fechaInicio, datos.fechaFin);
        
        // *** INICIO DE LA CORRECCIÓN ***
        // Usar un loop 'for...of' para permitir 'await' adentro
        for (const item of dataReporte) {
            if (item.periodos.length > 0) {
                reporteGenerado += `🏡 Cabaña ${item.nombre}:\n`;
                
                // Este 'await' ahora es legal
                const propData = await obtenerPropiedadPorId(db, empresaId, item.id); 
                const imagenUrl = propData ? obtenerImagenPrincipal(propData) : '';
                if (imagenUrl && !imagenUrl.includes('via.placeholder.com')) reporteGenerado += `${imagenUrl}\n`;

                if(item.valor > 0) reporteGenerado += `Valor: ${formatCurrencyRep(item.valor)}\n`;
                if(item.capacidad > 0) reporteGenerado += `Capacidad: ${item.capacidad} personas\n`;

                item.periodos.forEach(p => {
                    const finDate = new Date(p.fin + 'T00:00:00Z');
                    if(new Date(p.inicio) <= finDate) {
                       reporteGenerado += `👍 Del ${formatDateRep(p.inicio)} al ${formatDateRep(p.fin)}\n`;
                    }
                });
                reporteGenerado += `\n`;
            }
        }
        // *** FIN DE LA CORRECCIÓN ***

        texto = texto.replace(/\[FECHA_INICIO_REPORTE\]/g, formatDateRep(datos.fechaInicio));
        texto = texto.replace(/\[FECHA_FIN_REPORTE\]/g, formatDateRep(datos.fechaFin));
        texto = texto.replace(/\[REPORTE_DISPONIBILIDAD\]/g, reporteGenerado.trim());
    }

    return texto;
};


module.exports = {
    prepararMensaje,
    generarTextoPropuesta,
    generarTextoReporte,
    generarTextoPresupuesto // <-- AÑADIDO A EXPORTS
};