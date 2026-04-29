// backend/routes/reservas.js

const express = require('express');
const multer = require('multer');
const pool = require('../db/postgres');
const { fetchTarifasYCanal } = require('./website.shared');
const { calcularComparadorOtaTotales } = require('../services/comparadorOtaService');
const {
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    decidirYEliminarReserva,
    eliminarGrupoReservasCascada
} = require('../services/reservasService');
const { gestionarDocumentoReserva } = require('../services/documentosService');
const { actualizarIdReservaCanalEnCascada } = require('../services/utils/cascadingUpdateService');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const reservas = await obtenerReservasPorEmpresa(db, req.user.empresaId);
            res.status(200).json(reservas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const reserva = await obtenerReservaPorId(db, req.user.empresaId, req.params.id);
            res.status(200).json(reserva);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });

    router.get('/:id/comparador-ota', async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const reservaId = req.params.id;
            const canalIdQuery = String(req.query.canalId || '').trim();
            const { rows } = await pool.query(
                `SELECT id, propiedad_id, fecha_llegada, fecha_salida
                 FROM reservas
                 WHERE id = $1 AND empresa_id = $2
                 LIMIT 1`,
                [reservaId, empresaId],
            );
            const row = rows[0];
            if (!row) return res.status(404).json({ error: 'Reserva no encontrada.' });
            if (!row.propiedad_id || !row.fecha_llegada || !row.fecha_salida) {
                return res.status(400).json({ error: 'La reserva no tiene datos suficientes para comparador OTA.' });
            }

            const fechaLlegada = String(row.fecha_llegada).slice(0, 10);
            const fechaSalida = String(row.fecha_salida).slice(0, 10);
            const startDate = new Date(`${fechaLlegada}T00:00:00Z`);
            const endDate = new Date(`${fechaSalida}T00:00:00Z`);
            if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
                return res.status(400).json({ error: 'Rango de fechas inválido para comparador OTA.' });
            }

            const { allTarifas } = await fetchTarifasYCanal(empresaId);
            const { rows: canalesRows } = await pool.query(
                `SELECT id, nombre, COALESCE(metadata->>'moneda', 'CLP') AS moneda,
                        COALESCE((metadata->>'esCanalPorDefecto')::boolean, false) AS es_canal_por_defecto
                 FROM canales
                 WHERE empresa_id = $1
                 ORDER BY CASE WHEN (metadata->>'esCanalPorDefecto')::boolean THEN 0 ELSE 1 END, nombre ASC`,
                [empresaId],
            );
            const canales = canalesRows.map((r) => ({
                id: r.id,
                nombre: r.nombre,
                moneda: r.moneda || 'CLP',
                esCanalPorDefecto: !!r.es_canal_por_defecto,
            }));
            const canalDirecto = canales.find((c) => c.esCanalPorDefecto);
            if (!canalDirecto) return res.status(400).json({ error: 'No hay canal por defecto configurado.' });
            const canalComparado = canalIdQuery
                ? canales.find((c) => c.id === canalIdQuery && c.id !== canalDirecto.id)
                : canales.find((c) => c.id !== canalDirecto.id);
            if (!canalComparado) return res.status(400).json({ error: 'No hay canal comparado disponible.' });

            const cmp = calcularComparadorOtaTotales({
                allTarifas,
                propiedadId: row.propiedad_id,
                startDate,
                endDate,
                canalDirectoId: canalDirecto.id,
                canalComparadoId: canalComparado.id,
            });
            if (!cmp.ok) return res.status(400).json({ error: cmp.error || 'No se pudo calcular comparador OTA.' });

            return res.status(200).json({
                ok: true,
                rango: { fechaLlegada, fechaSalida, noches: cmp.nights },
                canalDirecto: { id: canalDirecto.id, nombre: canalDirecto.nombre, moneda: canalDirecto.moneda },
                canalComparado: { id: canalComparado.id, nombre: canalComparado.nombre, moneda: canalComparado.moneda },
                canalesComparables: canales
                    .filter((c) => c.id !== canalDirecto.id)
                    .map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda })),
                totales: {
                    directoCLP: cmp.totalDirectoCLP,
                    comparadoCLP: cmp.totalComparadoCLP,
                    ahorroCLP: cmp.ahorroCLP,
                    ahorroPctSobreComparado: cmp.pctSobreComparado,
                },
                comparableComplete: cmp.nochesSinTarifaComparada === 0,
                nochesSinTarifaComparada: cmp.nochesSinTarifaComparada,
                disclaimer: 'Comparador referencial para decisión comercial; no modifica valores de reservas.',
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const reservaActualizada = await actualizarReservaManualmente(db, req.user.empresaId, req.user.email, req.params.id, req.body);
            res.status(200).json(reservaActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/actualizar-id-canal/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const { idAntiguo, idNuevo } = req.body;
            const summary = await actualizarIdReservaCanalEnCascada(db, empresaId, id, idAntiguo, idNuevo);
            res.status(200).json({ 
                message: 'El ID de la reserva se ha actualizado en cascada correctamente.',
                summary: summary
            });
        } catch (error) {
            console.error("Error en la ruta de actualización de ID en cascada:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/:id/documento', upload.single('documento'), async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const { tipoDocumento, accion } = req.body;
            const archivo = req.file;

            const reservaActualizada = await gestionarDocumentoReserva(db, empresaId, id, tipoDocumento, archivo, accion);
            res.status(200).json(reservaActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const resultado = await decidirYEliminarReserva(db, req.user.empresaId, req.params.id);
            res.status(200).json(resultado);
        } catch (error) {
            if (error.code === 409) {
                res.status(409).json({ error: error.message, data: error.data });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.post('/grupo/eliminar', async (req, res) => {
        try {
            const { idReservaCanal } = req.body;
            if (!idReservaCanal) {
                return res.status(400).json({ error: 'Se requiere idReservaCanal.' });
            }
            const resultado = await eliminarGrupoReservasCascada(db, req.user.empresaId, idReservaCanal);
            res.status(200).json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};