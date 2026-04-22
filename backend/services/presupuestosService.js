// backend/services/presupuestosService.js
const pool = require('../db/postgres');
const { obtenerPropiedadPorId } = require('./propiedadesService');
const { obtenerClientePorId } = require('./clientesService');
const { obtenerTarifasParaConsumidores } = require('./tarifasService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { calcularPrecioDetallado } = require('./utils/calculoTarifaUtils');
const { obtenerValorDolar } = require('./dolarService');

function calcularTotalesYAjustes(propiedadesInfo, serviciosAdicionales, ajustePrecio, tipoAjuste, valorDolar) {
    const subtotalCLP = propiedadesInfo.reduce((acc, p) => acc + p.precioTotalCLP, 0);
    const adicionalesCLP = (serviciosAdicionales || []).reduce((acc, s) => acc + s.monto, 0);

    let montoAjusteCLP = 0;
    if (ajustePrecio && tipoAjuste) {
        montoAjusteCLP = tipoAjuste === 'porcentaje'
            ? (subtotalCLP + adicionalesCLP) * (ajustePrecio / 100)
            : ajustePrecio;
    }

    const totalFinalCLP = subtotalCLP + adicionalesCLP + montoAjusteCLP;
    return {
        subtotalCLP,
        adicionalesCLP,
        montoAjusteCLP,
        totalFinalCLP,
        totalFinalUSD: totalFinalCLP / valorDolar,
        comisionTotalCLP: propiedadesInfo.reduce((acc, p) => acc + p.comisionCalculada, 0)
    };
}

function obtenerImagenPrincipal(propiedad) {
    if (propiedad.websiteData && propiedad.websiteData.images) {
        const imagenes = propiedad.websiteData.images;
        const portada = imagenes['portadaRecinto']?.[0] || imagenes['exteriorAlojamiento']?.[0];
        if (portada) return portada.storagePath;
        const allImages = Object.values(imagenes).flat();
        if (allImages.length > 0) return allImages[0].storagePath;
    }
    return null;
}

async function generarPresupuesto(db, empresaId, datos) {
    const {
        clienteId, propiedadIds, fechaLlegada, fechaSalida,
        adultos, ninos, noches, serviciosAdicionales,
        ajustePrecio, tipoAjuste, enviarEmail,
        aplicarAjusteTotal, comisionAgencia
    } = datos;

    const cliente = await obtenerClientePorId(db, empresaId, clienteId);
    if (!cliente) throw new Error('Cliente no encontrado');

    let valorDolar = 800;
    try {
        const dolarData = await obtenerValorDolar(db, empresaId);
        valorDolar = dolarData?.valor || dolarData || 800;
    } catch (e) {
        console.warn(`No se pudo obtener valor del dólar para ${empresaId}, usando fallback. Error: ${e.message}`);
    }

    const canales = await obtenerCanalesPorEmpresa(null, empresaId);
    const canalPD = canales.find(c => c.esCanalPorDefecto || c.metadata?.esCanalPorDefecto);
    const canalIdParaPrecio = canalPD?.id;
    const todasLasTarifas = await obtenerTarifasParaConsumidores(empresaId);

    const llegada = new Date(fechaLlegada);
    const salida = new Date(fechaSalida);

    const propiedadesInfo = [];
    for (const propId of propiedadIds) {
        const p = await obtenerPropiedadPorId(db, empresaId, propId);
        if (!p) continue;
        const tarifas = todasLasTarifas.filter(t =>
            t.alojamientoId === propId &&
            t.fechaInicio <= salida &&
            t.fechaTermino >= llegada
        );
        const calculo = calcularPrecioDetallado(tarifas, noches, comisionAgencia, canalIdParaPrecio);
        propiedadesInfo.push({
            id: p.id,
            nombre: p.nombre,
            linkFotos: obtenerImagenPrincipal(p),
            capacidad: p.capacidad,
            precioNocheCLP: calculo.precioPromedioNocheCLP,
            precioTotalCLP: calculo.precioTotalCLP,
            precioTotalUSD: calculo.precioTotalCLP / valorDolar,
            comisionCalculada: calculo.comisionTotalCLP
        });
    }

    const totales = calcularTotalesYAjustes(propiedadesInfo, serviciosAdicionales, ajustePrecio, tipoAjuste, valorDolar);

    const nuevoPresupuesto = {
        clienteId: cliente.id, clienteNombre: cliente.nombre, clienteEmail: cliente.email,
        fechaCreacion: new Date(), fechaLlegada, fechaSalida, noches, adultos, ninos,
        propiedades: propiedadesInfo, serviciosAdicionales: serviciosAdicionales || [],
        ajuste: {
            monto: totales.montoAjusteCLP, tipo: tipoAjuste || null,
            descripcion: datos.descripcionAjuste || '',
            aplicadoAlTotal: aplicarAjusteTotal !== undefined ? aplicarAjusteTotal : true
        },
        comisionAgencia: comisionAgencia || 0,
        comisionTotalCalculada: totales.comisionTotalCLP,
        subtotalCLP: totales.subtotalCLP,
        adicionalesCLP: totales.adicionalesCLP,
        totalFinalCLP: totales.totalFinalCLP,
        totalFinalUSD: totales.totalFinalUSD,
        estado: 'pendiente',
        enviadoPorEmail: enviarEmail || false
    };

    const { rows } = await pool.query(
        `INSERT INTO presupuestos (empresa_id, cliente_id, estado, datos) VALUES ($1,$2,'pendiente',$3) RETURNING id`,
        [empresaId, cliente.id, JSON.stringify(nuevoPresupuesto)]
    );
    nuevoPresupuesto.id = rows[0].id;

    if (enviarEmail) {
        console.log(`Simulando envío de email para presupuesto ${nuevoPresupuesto.id} a ${cliente.email}`);
        // TODO: Implementar lógica de envío de email
    }

    return nuevoPresupuesto;
}

async function obtenerPresupuestos(_db, empresaId) {
    const { rows } = await pool.query(
        `SELECT id, estado, datos, created_at FROM presupuestos WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [empresaId]
    );
    return rows.map(r => ({ id: r.id, estado: r.estado, ...r.datos, fechaCreacion: r.created_at }));
}

async function obtenerPresupuestoPorId(_db, empresaId, presupuestoId) {
    const { rows } = await pool.query(
        'SELECT id, estado, datos, created_at FROM presupuestos WHERE id = $1 AND empresa_id = $2',
        [presupuestoId, empresaId]
    );
    if (!rows[0]) throw new Error('Presupuesto no encontrado');
    return { id: rows[0].id, estado: rows[0].estado, ...rows[0].datos, fechaCreacion: rows[0].created_at };
}

async function actualizarEstadoPresupuesto(_db, empresaId, presupuestoId, estado) {
    if (!['pendiente', 'aceptado', 'rechazado'].includes(estado)) throw new Error('Estado no válido');
    await pool.query(
        'UPDATE presupuestos SET estado = $1 WHERE id = $2 AND empresa_id = $3',
        [estado, presupuestoId, empresaId]
    );
    return { id: presupuestoId, estado };
}

module.exports = {
    generarPresupuesto,
    obtenerPresupuestos,
    obtenerPresupuestoPorId,
    actualizarEstadoPresupuesto
};
