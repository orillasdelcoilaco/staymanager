// backend/services/tarifasService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

function mapearTarifa(row) {
    if (!row) return null;
    const reglas = row.reglas || {};
    return { id: row.id, alojamientoId: row.propiedad_id, temporada: reglas.temporada, precios: reglas.precios || {}, fechaInicio: reglas.fechaInicio, fechaTermino: reglas.fechaTermino, activa: row.activa };
}

async function calcularPreciosPorCanal(db, empresaId, datosTarifa, fechaInicioDate) {
    const { obtenerCanalesPorEmpresa } = require('./canalesService');
    const canales = await obtenerCanalesPorEmpresa(db, empresaId);
    const canalPD = canales.find(c => c.esCanalPorDefecto || c.metadata?.esCanalPorDefecto);
    if (!canalPD) throw new Error('No se ha configurado un canal por defecto.');
    const precioBase = parseFloat(datosTarifa.precioBase);
    if (isNaN(precioBase)) throw new Error('El valor de precioBase no es válido.');
    const valorDolarDia = await obtenerValorDolar(db, empresaId, fechaInicioDate);
    const preciosFinales = {};
    for (const canal of canales) {
        let val = precioBase;
        const mc = canal.moneda || canal.metadata?.moneda || 'CLP';
        const md = canalPD.moneda || canalPD.metadata?.moneda || 'CLP';
        if (mc === 'USD' && md === 'CLP' && valorDolarDia > 0) val = precioBase / valorDolarDia;
        else if (mc === 'CLP' && md === 'USD' && valorDolarDia > 0) val = precioBase * valorDolarDia;
        const modTipo  = canal.modificadorTipo  || canal.metadata?.modificadorTipo;
        const modValor = canal.modificadorValor || canal.metadata?.modificadorValor || 0;
        if (canal.id !== canalPD.id && modValor) {
            if (modTipo === 'porcentaje') val *= (1 + modValor / 100);
            else if (modTipo === 'fijo')  val += modValor;
        }
        preciosFinales[canal.id] = mc === 'USD' ? { valorUSD: val, valorCLP: val * valorDolarDia, moneda: 'USD' } : { valorCLP: val, moneda: 'CLP' };
    }
    return { preciosFinales, canalPorDefectoId: canalPD.id, valorDolarDia };
}

const crearTarifa = async (db, empresaId, datosTarifa) => {
    if (!datosTarifa.alojamientoId || !datosTarifa.precioBase) throw new Error('Faltan datos requeridos.');
    const fechaInicioDate = new Date(datosTarifa.fechaInicio + 'T00:00:00Z');
    const { preciosFinales, canalPorDefectoId } = await calcularPreciosPorCanal(db, empresaId, datosTarifa, fechaInicioDate);

    if (pool) {
        const reglas = { temporada: datosTarifa.temporada, fechaInicio: datosTarifa.fechaInicio, fechaTermino: datosTarifa.fechaTermino, precios: { [canalPorDefectoId]: parseFloat(datosTarifa.precioBase) } };
        const { rows } = await pool.query(`INSERT INTO tarifas (empresa_id, propiedad_id, nombre, reglas, activa) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [empresaId, datosTarifa.alojamientoId, datosTarifa.temporada || '', JSON.stringify(reglas), true]);
        return { ...mapearTarifa(rows[0]), precios: preciosFinales };
    }

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc();
    const datosGuardar = { alojamientoId: datosTarifa.alojamientoId, temporada: datosTarifa.temporada, fechaInicio: admin.firestore.Timestamp.fromDate(fechaInicioDate), fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaTermino + 'T00:00:00Z')), precios: { [canalPorDefectoId]: parseFloat(datosTarifa.precioBase) }, fechaCreacion: admin.firestore.FieldValue.serverTimestamp() };
    await tarifaRef.set(datosGuardar);
    return { id: tarifaRef.id, ...datosGuardar, precios: preciosFinales };
};

const obtenerTarifasPorEmpresa = async (db, empresaId) => {
    const { obtenerCanalesPorEmpresa } = require('./canalesService');
    const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');

    if (pool) {
        const [{ rows }, propiedades, canales] = await Promise.all([
            pool.query(`SELECT * FROM tarifas WHERE empresa_id = $1 ORDER BY (reglas->>'fechaInicio') DESC`, [empresaId]),
            obtenerPropiedadesPorEmpresa(db, empresaId),
            obtenerCanalesPorEmpresa(db, empresaId)
        ]);
        const propMap = new Map(propiedades.map(p => [p.id, p.nombre]));
        const canalPD = canales.find(c => c.esCanalPorDefecto || c.metadata?.esCanalPorDefecto);
        if (!canalPD) throw new Error('No se ha configurado un canal por defecto.');
        return Promise.all(rows.map(async row => {
            const reglas = row.reglas || {};
            const fechaInicioDate = reglas.fechaInicio ? new Date(reglas.fechaInicio + 'T00:00:00Z') : new Date();
            const valorDolarDia = await obtenerValorDolar(db, empresaId, fechaInicioDate);
            const precioBase = reglas.precios?.[canalPD.id] || 0;
            const preciosFinales = {};
            for (const canal of canales) {
                let val = precioBase;
                const mc = canal.moneda || canal.metadata?.moneda || 'CLP';
                const md = canalPD.moneda || canalPD.metadata?.moneda || 'CLP';
                if (mc === 'USD' && md === 'CLP' && valorDolarDia > 0) val = precioBase / valorDolarDia;
                else if (mc === 'CLP' && md === 'USD' && valorDolarDia > 0) val = precioBase * valorDolarDia;
                const modTipo = canal.modificadorTipo || canal.metadata?.modificadorTipo;
                const modValor = canal.modificadorValor || canal.metadata?.modificadorValor || 0;
                if (canal.id !== canalPD.id && modValor) {
                    if (modTipo === 'porcentaje') val *= (1 + modValor / 100);
                    else if (modTipo === 'fijo') val += modValor;
                }
                preciosFinales[canal.id] = mc === 'USD' ? { valorUSD: val, valorCLP: val * valorDolarDia, moneda: 'USD' } : { valorCLP: val, moneda: 'CLP' };
            }
            return { id: row.id, alojamientoId: row.propiedad_id, alojamientoNombre: propMap.get(row.propiedad_id) || 'No encontrado', temporada: reglas.temporada, precios: preciosFinales, fechaInicio: reglas.fechaInicio, fechaTermino: reglas.fechaTermino, valorDolarDia };
        }));
    }

    const [tarifasSnap, propSnap, canalSnap] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('tarifas').orderBy('fechaInicio', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('canales').get()
    ]);
    if (tarifasSnap.empty) return [];
    const propMap = new Map(propSnap.docs.map(d => [d.id, d.data().nombre]));
    const canales = canalSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const canalPD = canales.find(c => c.esCanalPorDefecto);
    if (!canalPD) throw new Error('No se ha configurado un canal por defecto.');
    return Promise.all(tarifasSnap.docs.map(async doc => {
        const data = doc.data();
        const fechaInicioDate = data.fechaInicio.toDate();
        const valorDolarDia = await obtenerValorDolar(db, empresaId, fechaInicioDate);
        const precioBase = data.precios?.[canalPD.id] || 0;
        const preciosFinales = {};
        for (const canal of canales) {
            let val = precioBase;
            if (canal.moneda === 'USD' && canalPD.moneda === 'CLP' && valorDolarDia > 0) val = precioBase / valorDolarDia;
            else if (canal.moneda === 'CLP' && canalPD.moneda === 'USD' && valorDolarDia > 0) val = precioBase * valorDolarDia;
            if (canal.id !== canalPD.id && canal.modificadorValor) {
                if (canal.modificadorTipo === 'porcentaje') val *= (1 + canal.modificadorValor / 100);
                else if (canal.modificadorTipo === 'fijo') val += canal.modificadorValor;
            }
            preciosFinales[canal.id] = canal.moneda === 'USD' ? { valorUSD: val, valorCLP: val * valorDolarDia, moneda: 'USD' } : { valorCLP: val, moneda: 'CLP' };
        }
        return { id: doc.id, alojamientoId: data.alojamientoId, alojamientoNombre: propMap.get(data.alojamientoId) || 'No encontrado', temporada: data.temporada, precios: preciosFinales, fechaInicio: fechaInicioDate.toISOString().split('T')[0], fechaTermino: data.fechaTermino.toDate().toISOString().split('T')[0], valorDolarDia };
    }));
};

const actualizarTarifa = async (db, empresaId, tarifaId, datosActualizados) => {
    const fechaInicioDate = new Date((datosActualizados.fechaInicio || new Date().toISOString().split('T')[0]) + 'T00:00:00Z');
    const { preciosFinales, canalPorDefectoId } = await calcularPreciosPorCanal(db, empresaId, datosActualizados, fechaInicioDate);
    if (pool) {
        const { rows: ex } = await pool.query('SELECT * FROM tarifas WHERE id = $1 AND empresa_id = $2', [tarifaId, empresaId]);
        if (!ex[0]) throw new Error('La tarifa que intentas actualizar no existe.');
        const reglas = { ...ex[0].reglas, temporada: datosActualizados.temporada || ex[0].reglas?.temporada, fechaInicio: datosActualizados.fechaInicio || ex[0].reglas?.fechaInicio, fechaTermino: datosActualizados.fechaTermino || ex[0].reglas?.fechaTermino, precios: { [canalPorDefectoId]: parseFloat(datosActualizados.precioBase) } };
        await pool.query('UPDATE tarifas SET reglas = $2, updated_at = NOW() WHERE id = $1 AND empresa_id = $3', [tarifaId, JSON.stringify(reglas), empresaId]);
        return { id: tarifaId, ...datosActualizados, precios: preciosFinales };
    }
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(tarifaRef);
        if (!doc.exists) throw new Error('La tarifa que intentas actualizar no existe.');
        transaction.update(tarifaRef, { temporada: datosActualizados.temporada, fechaInicio: admin.firestore.Timestamp.fromDate(fechaInicioDate), fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaTermino + 'T00:00:00Z')), precios: { [canalPorDefectoId]: parseFloat(datosActualizados.precioBase) }, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
    });
    return { id: tarifaId, ...datosActualizados };
};

const eliminarTarifa = async (db, empresaId, tarifaId) => {
    if (pool) { await pool.query('DELETE FROM tarifas WHERE id = $1 AND empresa_id = $2', [tarifaId, empresaId]); return; }
    await db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId).delete();
};

module.exports = { crearTarifa, obtenerTarifasPorEmpresa, actualizarTarifa, eliminarTarifa };
