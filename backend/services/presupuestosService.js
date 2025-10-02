const { calculatePrice } = require('./propuestasService');
const { obtenerTiposPlantilla, obtenerPlantillasPorEmpresa } = require('./plantillasService');
const { obtenerDetallesEmpresa } = require('./empresaService');

const formatDate = (dateString) => {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

const generarTextoPresupuesto = async (db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades, personas) => {
    const [tipos, plantillas, empresaData] = await Promise.all([
        obtenerTiposPlantilla(db, empresaId),
        obtenerPlantillasPorEmpresa(db, empresaId),
        obtenerDetallesEmpresa(db, empresaId)
    ]);

    const tipoPresupuesto = tipos.find(t => t.nombre.toLowerCase().includes('presupuesto'));
    if (!tipoPresupuesto) {
        throw new Error('No se encontró un "Tipo de Plantilla" llamado "Presupuesto". Por favor, créalo en la sección de gestión de plantillas.');
    }

    const plantilla = plantillas.find(p => p.tipoId === tipoPresupuesto.id);
    if (!plantilla) {
        throw new Error('No se encontró ninguna plantilla de tipo "Presupuesto". Por favor, crea una.');
    }

    let texto = plantilla.texto;

    const startDate = new Date(fechaLlegada + 'T00:00:00Z');
    const endDate = new Date(fechaSalida + 'T00:00:00Z');
    const noches = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        const fechaInicio = data.fechaInicio && typeof data.fechaInicio.toDate === 'function' ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
        const fechaTermino = data.fechaTermino && typeof data.fechaTermino.toDate === 'function' ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
        return {
            ...data,
            fechaInicio,
            fechaTermino
        };
    });

    const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas);
    
    let detalleCabañas = '';
    for (const prop of propiedades) {
        const precioDetalle = pricing.details.find(d => d.nombre === prop.nombre);
        detalleCabañas += `🔹 Cabaña ${prop.nombre} (Capacidad: ${prop.capacidad} personas)\n`;
        if (prop.camas) {
            if (prop.camas.matrimoniales) detalleCabañas += `* ${prop.camas.matrimoniales} dormitorio(s) matrimoniales${prop.equipamiento?.piezaEnSuite ? ' (uno en suite)' : ''}.\n`;
            if (prop.camas.plazaYMedia) detalleCabañas += `* ${prop.camas.plazaYMedia} cama(s) de 1.5 plazas.\n`;
            if (prop.camas.camarotes) detalleCabañas += `* ${prop.camas.camarotes} camarote(s).\n`;
        }
        if (prop.numBanos) detalleCabañas += `* ${prop.numBanos} baño(s) completo(s).\n`;
        
        if (prop.descripcion) {
            detalleCabañas += `* ${prop.descripcion}\n`;
        }

        if (prop.equipamiento) {
            if (prop.equipamiento.terrazaTechada) detalleCabañas += `* Terraza techada.\n`;
            if (prop.equipamiento.tinaja) detalleCabañas += `* Tinaja privada.\n`;
            if (prop.equipamiento.parrilla) detalleCabañas += `* Parrilla.\n`;
        }

        if (prop.linkFotos) detalleCabañas += `📷 Ver fotos: ${prop.linkFotos}\n`;
        if (precioDetalle) {
            detalleCabañas += `💵 Valor por noche: ${formatCurrency(precioDetalle.precioPorNoche)}\n`;
            detalleCabañas += `💵 Total por ${noches} noches: ${formatCurrency(precioDetalle.precioTotal)}\n`;
        }
        detalleCabañas += '\n';
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
        '[TOTAL_GENERAL]': formatCurrency(pricing.totalPrice),
        '[RESUMEN_CANTIDAD_CABANAS]': propiedades.length,
        '[RESUMEN_CAPACIDAD_TOTAL]': propiedades.reduce((sum, p) => sum + p.capacidad, 0),
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
        texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor);
    }

    return texto;
};

module.exports = {
    generarTextoPresupuesto
};