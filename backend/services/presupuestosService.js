const { calculatePrice } = require('./propuestasService');
const { obtenerTiposPlantilla, obtenerPlantillasPorEmpresa } = require('./plantillasService');

const formatDate = (dateString) => {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

const generarTextoPresupuesto = async (db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades) => {
    const [tipos, plantillas] = await Promise.all([
        obtenerTiposPlantilla(db, empresaId),
        obtenerPlantillasPorEmpresa(db, empresaId),
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
        return {
            ...data,
            fechaInicio: data.fechaInicio.toDate(),
            fechaTermino: data.fechaTermino.toDate()
        };
    });

    const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas);
    
    let detalleCabañas = '';
    for (const prop of propiedades) {
        const precioDetalle = pricing.details.find(d => d.nombre === prop.nombre);
        detalleCabañas += `* Cabaña ${prop.nombre} (Capacidad: ${prop.capacidad} personas)\n`;
        if (prop.camas) {
            if (prop.camas.matrimoniales) detalleCabañas += `  * ${prop.camas.matrimoniales} dormitorio(s) matrimoniales${prop.equipamiento?.piezaEnSuite ? ' (uno en suite)' : ''}.\n`;
            if (prop.camas.plazaYMedia) detalleCabañas += `  * ${prop.camas.plazaYMedia} cama(s) de 1.5 plazas.\n`;
            if (prop.camas.camarotes) detalleCabañas += `  * ${prop.camas.camarotes} camarote(s).\n`;
        }
        if (prop.numBanos) detalleCabañas += `  * ${prop.numBanos} baño(s) completo(s).\n`;
        
        detalleCabañas += `  * Espacio abierto con cocina, comedor y living integrados.\n`;
        if (prop.equipamiento?.terrazaTechada) detalleCabañas += `  * Terraza techada.\n`;
        if (prop.equipamiento?.tinaja) detalleCabañas += `  * Tinaja privada.\n`;
        if (prop.equipamiento?.parrilla) detalleCabañas += `  * Parrilla.\n`;

        if (prop.linkFotos) detalleCabañas += `  * Ver fotos: ${prop.linkFotos}\n`;
        if (precioDetalle) {
            detalleCabañas += `  * Valor por noche: ${formatCurrency(precioDetalle.precioPorNoche)}\n`;
            detalleCabañas += `  * Total por ${noches} noches: ${formatCurrency(precioDetalle.precioTotal)}\n`;
        }
        detalleCabañas += '\n';
    }

    const reemplazos = {
        '[CLIENTE_NOMBRE]': cliente.nombre,
        '[CLIENTE_EMPRESA]': cliente.empresa || '',
        '[FECHA_EMISION]': new Date().toLocaleDateString('es-CL'),
        '[FECHA_LLEGADA]': formatDate(fechaLlegada),
        '[FECHA_SALIDA]': formatDate(fechaSalida),
        '[TOTAL_NOCHES]': noches,
        '[CANTIDAD_HUESPEDES]': propiedades.reduce((sum, p) => sum + p.capacidad, 0),
        '[LISTA_DE_CABANAS]': detalleCabañas.trim(),
        '[TOTAL_GENERAL]': formatCurrency(pricing.totalPrice)
    };
    
    for (const [etiqueta, valor] of Object.entries(reemplazos)) {
        texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor);
    }

    return texto;
};

module.exports = {
    generarTextoPresupuesto
};