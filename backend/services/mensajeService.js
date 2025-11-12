// backend/services/mensajeService.js

const { obtenerPlantillasPorEmpresa, obtenerTiposPlantilla } = require('./plantillasService');
const { obtenerDetallesEmpresa } = require('./empresaService');
const { getActividadDiaria, getDisponibilidadPeriodo } = require('./reportesService');
const { obtenerPropiedadPorId } = require('./propiedadesService'); // Necesario para obtenerImagenPrincipal
const { calculatePrice } = require('./utils/calculoValoresService');
const { obtenerValorDolarHoy } = require('./dolarService'); // Necesario para generarTextoPresupuesto
const { format, addDays } = require('date-fns');
const es = require('date-fns/locale/es');

// Función auxiliar para obtener la imagen principal (se mantiene igual, útil para reporte de disponibilidad)
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
        if (tipoMensaje.toLowerCase() === 'salida') {
            const tipoDespedida = todosLosTipos.find(t => t.nombre.toLowerCase().includes('despedida'));
            if (tipoDespedida) {
                const plantillasFiltradas = todasLasPlantillas.filter(p => p.tipoId === tipoDespedida.id);
                return { plantillas: plantillasFiltradas, datosReserva: grupoReserva || {} };
            }
        }
        throw new Error(`No se encontró un tipo de plantilla para '${tipoMensaje}'.`);
    }

    const plantillasFiltradas = todasLasPlantillas.filter(p => p.tipoId === tipo.id);
    
    return {
        plantillas: plantillasFiltradas,
        datosReserva: grupoReserva || {}
    };
};

const generarTextoPropuesta = async (db, empresaId, datosPropuesta) => {
    // Añadimos 'permitirCambios' a la destructuración
    const { cliente, propiedades, fechaLlegada, fechaSalida, personas, noches, precioFinal, idPropuesta, precioListaCLP, descuentoCLP, pricingDetails, moneda, valorDolarDia, permitirCambios } = datosPropuesta;

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

    // --- INICIO DE LA CORRECCIÓN ---
    // Restaurar la definición local de formatCurrency
    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
    // --- FIN DE LA CORRECCIÓN ---

    const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

    // (Esta sección se mantiene 100% original)
    const baseUrl = empresaData.websiteSettings?.domain
        ? `https://${empresaData.websiteSettings.domain}`
        : (empresaData.websiteSettings?.subdomain
            ? `https://${empresaData.websiteSettings.subdomain}.onrender.com`
            : (empresaData.website || '#'));

    let detallePropiedades = propiedades.map(prop => {
        // (Esta sección se mantiene 100% original)
        let detalle = `Cabaña ${prop.nombre}: `;
        const detalles = [];
        if (prop.camas?.matrimoniales) detalles.push(`* ${prop.camas.matrimoniales} dormitorio(s) matrimoniales${prop.equipamiento?.piezaEnSuite ? ' (uno en suite)' : ''}.`);
        if (prop.camas?.plazaYMedia) detalles.push(`* ${prop.camas.plazaYMedia} cama(s) de 1.5 plazas.`);
        if (prop.camas?.camarotes) detalles.push(`* ${prop.camas.camarotes} camarote(s).`);
        if (prop.numBanos) detalles.push(`* ${prop.numBanos} baño(s) completo(s).`);

        const descripcionMostrar = prop.websiteData?.aiDescription || prop.descripcion;
        if (descripcionMostrar) detalles.push(`* ${descripcionMostrar}`);

        if (prop.equipamiento?.terrazaTechada) detalles.push(`* Terraza techada.`);
        if (prop.equipamiento?.tinaja) detalles.push(`* Tinaja privada.`);
        if (prop.equipamiento?.parrilla) detalles.push(`* Parrilla.`);

        const linkPaginaPropiedad = `${baseUrl}/propiedad/${prop.id}`;
        detalles.push(`📸 Ver detalles: ${linkPaginaPropiedad}`);

        return detalle + '\n' + detalles.join('\n');
    }).join('\n\n');


    // (Lógica de [RESUMEN_VALORES_PROPUESTA] que corregimos en el paso anterior)
    let resumenValores = "";

    // VERIFICACIÓN 1: MODO ITINERARIO
    if (permitirCambios === true && pricingDetails && pricingDetails.length > 0 && 'dailyRate' in pricingDetails[0]) {
        
        resumenValores = `📊 Detalle del Itinerario (${noches} Noches)\n----------------------------------\n`;
        
        let segmentos = [];
        let currentSegment = {
            properties: pricingDetails[0].properties.map(p => p.nombre).join(' + '),
            startDate: new Date(pricingDetails[0].date + 'T00:00:00Z'),
            endDate: new Date(pricingDetails[0].date + 'T00:00:00Z'),
            totalRate: pricingDetails[0].dailyRate
        };

        for (let i = 1; i < pricingDetails.length; i++) {
            const day = pricingDetails[i];
            const dayProperties = day.properties.map(p => p.nombre).join(' + ');
            const dayDate = new Date(day.date + 'T00:00:00Z');

            if (dayProperties === currentSegment.properties && addDays(currentSegment.endDate, 1).getTime() === dayDate.getTime()) {
                currentSegment.endDate = dayDate; // Extender segmento
                currentSegment.totalRate += day.dailyRate;
            } else {
                segmentos.push(currentSegment); // Guardar segmento anterior
                currentSegment = { // Empezar nuevo segmento
                    properties: dayProperties,
                    startDate: dayDate,
                    endDate: dayDate,
                    totalRate: day.dailyRate
                };
            }
        }
        segmentos.push(currentSegment); // Guardar el último segmento

        // Formatear los segmentos para el texto
        segmentos.forEach(seg => {
            const fLlegada = seg.startDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
            const fSalida = seg.endDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
            const dateLabel = fLlegada === fSalida ? fLlegada : `(${fLlegada} al ${fSalida})`;
            
            resumenValores += `${seg.properties} ${dateLabel}: ${formatCurrency(seg.totalRate)}\n`;
        });

    } 
    // VERIFICACIÓN 2: MODO NORMAL
    else if (pricingDetails && pricingDetails.length > 0 && 'precioTotal' in pricingDetails[0]) {
        
        resumenValores = `📊 Detalle por Alojamiento (${noches} Noches)\n----------------------------------\n`;
        resumenValores += propiedades.map(prop => {
            const precioDetalle = pricingDetails.find(d => d.nombre === prop.nombre);
            if (!precioDetalle) return `${prop.nombre}: (Error al calcular detalle)`;

            const precioTotalPropEnMonedaObjetivo = precioDetalle.precioTotal;
            // IMPORTANTE: El 'moneda' y 'valorDolarDia' son del *canal objetivo*
            const precioTotalPropEnCLP = moneda === 'USD'
                ? Math.round(precioTotalPropEnMonedaObjetivo * valorDolarDia)
                : precioTotalPropEnMonedaObjetivo;

            return `${prop.nombre}: ${formatCurrency(precioTotalPropEnCLP)}`;
        }).join('\n');
    }
    // VERIFICACIÓN 3: Fallback
    else {
        resumenValores = `📊 Detalle no disponible.\n`;
    }
    
    // Bloque de Totales Generales (común a ambos modos)
    resumenValores += `\n\n📈 Totales Generales\n----------------------------------\n`;
    resumenValores += `Subtotal: ${formatCurrency(precioListaCLP)}\n`;
    if (descuentoCLP > 0) {
        resumenValores += `Descuento Aplicado: -${formatCurrency(descuentoCLP)}\n`;
    }
    resumenValores += `----------------------------------\n`;
    resumenValores += `*TOTAL A PAGAR: ${formatCurrency(precioFinal)}* (IVA incluido)`;


    // (Lógica original de reemplazos)
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
    const fechaVencimientoStr = fechaVencimiento.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + " a las 23:59 hrs";
    
    const porcentajeAbono = empresaData.configuracion?.porcentajeAbono || 10;
    const montoAbono = precioFinal * (porcentajeAbono / 100);

    const reemplazos = {
        '[PROPUESTA_ID]': `APP-${(idPropuesta || '').substring(0, 15)}`,
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
        '[EMPRESA_NOMBRE]': empresaData.nombre || '',
        '[CONDICIONES_RESERVA]': empresaData.condicionesReserva || '',
    };
    
    for (const [etiqueta, valor] of Object.entries(reemplazos)) {
        texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor !== undefined && valor !== null ? valor : '');
    }

    return texto;
};

const generarTextoPresupuesto = async (db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades, personas) => {
    const [tipos, plantillas, empresaData, dolarHoy, canalesSnapshot] = await Promise.all([
        obtenerTiposPlantilla(db, empresaId),
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerDetallesEmpresa(db, empresaId),
        obtenerValorDolarHoy(db, empresaId),
        db.collection('empresas').doc(empresaId).collection('canales').get()
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

    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
     const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
        const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
        return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
    });

    const allCanales = canalesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const canalParaCalculo = allCanales.find(c => c.nombre.toLowerCase() === 'app') || allCanales.find(c => c.esCanalPorDefecto);
    if (!canalParaCalculo) {
        throw new Error("Se requiere un canal 'App' o un canal por defecto para calcular precios.");
    }

    const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, canalParaCalculo.id, dolarHoy.valor);
    
    // *** INICIO CORRECCIÓN LINK PÁGINA PÚBLICA ***
    // Determinar el dominio base de la empresa
    const baseUrl = empresaData.websiteSettings?.domain
        ? `https://${empresaData.websiteSettings.domain}`
        : (empresaData.websiteSettings?.subdomain
            ? `https://${empresaData.websiteSettings.subdomain}.onrender.com`
            : (empresaData.website || '#'));
    // *** FIN CORRECCIÓN LINK PÁGINA PÚBLICA ***


    let detalleCabañas = '';
    for (const prop of propiedades) {
        const precioDetalle = pricing.details.find(d => d.nombre === prop.nombre);
        
        // CORRECCIÓN: Usar precioTotalCLP del objeto pricing, no del detalle (que está en moneda objetivo)
        const precioTotalCLP = precioDetalle ? Math.round(pricing.totalPriceCLP / propiedades.length) : 0; // Asumir distribución equitativa
        const precioNocheCLP = noches > 0 ? Math.round(precioTotalCLP / noches) : 0;

        const propData = await obtenerPropiedadPorId(db, empresaId, prop.id);
        
        // *** INICIO CORRECCIÓN LINK PÁGINA PÚBLICA ***
        // Construir el link a la página de la propiedad
        const linkPaginaPropiedad = `${baseUrl}/propiedad/${prop.id}`;
        // *** FIN CORRECCIÓN LINK PÁGINA PÚBLICA ***

        detalleCabañas += `🔹 Cabaña ${prop.nombre} (Capacidad: ${prop.capacidad} personas)\n`;
         if (propData?.camas) {
            if (propData.camas.matrimoniales) detalleCabañas += `* ${propData.camas.matrimoniales} dorm. matrimonial(es).\n`;
            if (propData.camas.plazaYMedia) detalleCabañas += `* ${propData.camas.plazaYMedia} cama(s) 1.5 plz.\n`;
            if (propData.camas.camarotes) detalleCabañas += `* ${propData.camas.camarotes} camarote(s).\n`;
        }
        if (propData?.numBanos) detalleCabañas += `* ${propData.numBanos} baño(s).\n`;
        if (propData?.equipamiento) {
             if (propData.equipamiento.tinaja) detalleCabañas += `* Tinaja privada.\n`;
             if (propData.equipamiento.parrilla) detalleCabañas += `* Parrilla.\n`;
        }

        // *** INICIO CORRECCIÓN LINK PÁGINA PÚBLICA ***
        // Usar el link a la página, no el de la imagen
        if (linkPaginaPropiedad !== '#') {
             detalleCabañas += `📷 Ver detalles: ${linkPaginaPropiedad}\n`;
        }
        // *** FIN CORRECCIÓN LINK PÁGINA PÚBLICA ***

        detalleCabañas += `💵 Valor por noche: ${formatCurrency(precioNocheCLP)}\n`;
        detalleCabañas += `💵 Total por ${noches} noches: ${formatCurrency(precioTotalCLP)}\n\n`;
    }

    const reemplazos = {
        '[CLIENTE_NOMBRE]': cliente.nombre,
        '[CLIENTE_EMPRESA]': cliente.empresa || '',
        '[FECHA_EMISION]': new Date().toLocaleDateString('es-CL'),
        '[FECHA_LLEGADA]': formatDate(fechaLlegada),
        '[FECHA_SALIDA]': formatDate(fechaSalida),
        '[TOTAL_DIAS]': noches + 1,
        '[TOTAL_NOCHES]': noches,
        '[GRUPO_SOLICITADO]': personas,
        '[LISTA_DE_CABANAS]': detalleCabañas.trim(),
        '[TOTAL_GENERAL]': formatCurrency(pricing.totalPriceCLP),
        '[RESUMEN_CANTIDAD_CABANAS]': propiedades.length,
        '[RESUMEN_CAPACIDAD_TOTAL]': propiedades.reduce((sum, p) => sum + (p.capacidad || 0), 0),
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
        
        for (const item of dataReporte) {
            if (item.periodos.length > 0) {
                reporteGenerado += `🏡 Cabaña ${item.nombre}:\n`;
                
                const propData = await obtenerPropiedadPorId(db, empresaId, item.id);
                // *** INICIO CORRECCIÓN LINK PÁGINA PÚBLICA (en Reporte Disponibilidad) ***
                // (Necesitamos la empresaData también aquí para el dominio)
                const empresaData = await obtenerDetallesEmpresa(db, empresaId);
                const baseUrl = empresaData.websiteSettings?.domain
                    ? `https://${empresaData.websiteSettings.domain}`
                    : (empresaData.websiteSettings?.subdomain
                        ? `https://${empresaData.websiteSettings.subdomain}.onrender.com`
                        : '#');
                
                if (baseUrl !== '#') {
                     const linkPaginaPropiedad = `${baseUrl}/propiedad/${item.id}`;
                     reporteGenerado += `📷 Ver detalles: ${linkPaginaPropiedad}\n`;
                }
                // *** FIN CORRECCIÓN ***

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
    generarTextoPresupuesto
};