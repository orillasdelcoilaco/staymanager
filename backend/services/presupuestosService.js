// backend/services/presupuestosService.js
const { obtenerPropiedadPorId } = require('./propiedadesService');
const { obtenerClientePorId } = require('./clientesService');
const { obtenerTarifasParaRango } = require('./tarifasService');
// *** INICIO DE LA CORRECCIÓN ***
// La ruta correcta es relativa a la carpeta 'services'
const { calcularPrecioDetallado } = require('./utils/calculoTarifaUtils');
// *** FIN DE LA CORRECCIÓN ***
const { obtenerDolarObservado } = require('./dolarService');
const { format } = require('date-fns');

// Función auxiliar para obtener la imagen principal de una propiedad
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


async function generarPresupuesto(db, empresaId, datos) {
    const {
        clienteId,
        propiedadIds,
        fechaLlegada,
        fechaSalida,
        adultos,
        ninos,
        noches,
        serviciosAdicionales,
        ajustePrecio,
        tipoAjuste,
        enviarEmail,
        aplicarAjusteTotal,
        comisionAgencia
    } = datos;

    try {
        // 1. Obtener cliente
        const cliente = await obtenerClientePorId(db, empresaId, clienteId);
        if (!cliente) throw new Error('Cliente no encontrado');

        // 2. Obtener valor del dólar
        let valorDolar = 800; // Valor fallback
        try {
            const dolarData = await obtenerDolarObservado(db, empresaId);
            valorDolar = dolarData.valor;
        } catch (dolarError) {
            console.warn(`No se pudo obtener valor del dólar para ${empresaId}, usando fallback ${valorDolar}. Error: ${dolarError.message}`);
        }


        // 3. Procesar cada propiedad
        let propiedadesInfo = [];
        for (const propId of propiedadIds) {
            const p = await obtenerPropiedadPorId(db, empresaId, propId);
            if (!p) continue;

            const tarifas = await obtenerTarifasParaRango(db, empresaId, propId, fechaLlegada, fechaSalida);
            const calculo = calcularPrecioDetallado(tarifas, noches, comisionAgencia);

            const imagenUrl = obtenerImagenPrincipal(p);

            propiedadesInfo.push({
                id: p.id,
                nombre: p.nombre,
                linkFotos: imagenUrl,
                capacidad: p.capacidad,
                precioNocheCLP: calculo.precioPromedioNocheCLP,
                precioTotalCLP: calculo.precioTotalCLP,
                precioTotalUSD: (calculo.precioTotalCLP / valorDolar),
                comisionCalculada: calculo.comisionTotalCLP
            });
        }

        // 4. Calcular totales
        let precioTotalConsolidadoCLP = propiedadesInfo.reduce((acc, p) => acc + p.precioTotalCLP, 0);
        let precioTotalConsolidadoUSD = propiedadesInfo.reduce((acc, p) => acc + p.precioTotalUSD, 0);
        let comisionTotalConsolidadaCLP = propiedadesInfo.reduce((acc, p) => acc + p.comisionCalculada, 0);

        // 5. Aplicar servicios adicionales y ajustes
        let totalAdicionalesCLP = 0;
        if (serviciosAdicionales && serviciosAdicionales.length > 0) {
            totalAdicionalesCLP = serviciosAdicionales.reduce((acc, s) => acc + s.monto, 0);
        }

        let montoAjusteCLP = 0;
        if (ajustePrecio && tipoAjuste) {
            if (tipoAjuste === 'porcentaje') {
                montoAjusteCLP = (precioTotalConsolidadoCLP + totalAdicionalesCLP) * (ajustePrecio / 100);
            } else { // 'monto'
                montoAjusteCLP = ajustePrecio;
            }
        }

        let precioFinalCLP = (precioTotalConsolidadoCLP + totalAdicionalesCLP) + montoAjusteCLP;
        // La lógica de 'aplicarAjusteTotal' puede necesitar revisión si el ajuste debe ser por propiedad
        // if (!aplicarAjusteTotal) { /* lógica compleja aquí */ }

        const precioFinalUSD = precioFinalCLP / valorDolar;

        // 6. Guardar en Firestore
        const presupuestoRef = db.collection('empresas').doc(empresaId).collection('presupuestos').doc();
        const nuevoPresupuesto = {
            id: presupuestoRef.id,
            clienteId: cliente.id,
            clienteNombre: cliente.nombre,
            clienteEmail: cliente.email,
            fechaCreacion: new Date(),
            fechaLlegada,
            fechaSalida,
            noches,
            adultos,
            ninos,
            propiedades: propiedadesInfo,
            serviciosAdicionales: serviciosAdicionales || [],
            ajuste: {
                monto: montoAjusteCLP,
                tipo: tipoAjuste || null,
                descripcion: datos.descripcionAjuste || '',
                aplicadoAlTotal: aplicarAjusteTotal !== undefined ? aplicarAjusteTotal : true // Default a true
            },
            comisionAgencia: comisionAgencia || 0,
            comisionTotalCalculada: comisionTotalConsolidadaCLP,
            subtotalCLP: precioTotalConsolidadoCLP,
            adicionalesCLP: totalAdicionalesCLP,
            totalFinalCLP: precioFinalCLP,
            totalFinalUSD: precioFinalUSD,
            estado: 'pendiente',
            enviadoPorEmail: enviarEmail || false
        };

        await presupuestoRef.set(nuevoPresupuesto);

        // 7. Enviar email (si aplica)
        if (enviarEmail) {
            console.log(`Simulando envío de email para presupuesto ${presupuestoRef.id} a ${cliente.email}`);
            // TODO: Implementar lógica de envío de email
        }

        return nuevoPresupuesto;

    } catch (error) {
        console.error("Error al generar presupuesto:", error);
        throw error;
    }
}

async function obtenerPresupuestos(db, empresaId) {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('presupuestos')
        .orderBy('fechaCreacion', 'desc')
        .limit(50)
        .get();

    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
}

async function obtenerPresupuestoPorId(db, empresaId, presupuestoId) {
     const doc = await db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId).get();
     if (!doc.exists) {
         throw new Error('Presupuesto no encontrado');
     }
     return doc.data();
}

async function actualizarEstadoPresupuesto(db, empresaId, presupuestoId, estado) {
     if (!['pendiente', 'aceptado', 'rechazado'].includes(estado)) {
         throw new Error('Estado no válido');
     }
     const ref = db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId);
     await ref.update({ estado: estado });
     return { id: presupuestoId, estado: estado };
}


module.exports = {
    generarPresupuesto,
    obtenerPresupuestos,
    obtenerPresupuestoPorId,
    actualizarEstadoPresupuesto
};