// backend/services/utils/cascadingUpdateService.js
const pool = require('../../db/postgres');
const { updateGoogleContact } = require('../googleContactsService');
const { renameFileByUrl } = require('../storageService');

const actualizarIdReservaCanalEnCascada = async (db, empresaId, _idReserva, idAntiguo, idNuevo) => {
    if (!idAntiguo || !idNuevo || idAntiguo === idNuevo) {
        throw new Error("Se requieren un ID antiguo y uno nuevo, y deben ser diferentes.");
    }

    const summary = {
        postgres: {},
        storage: { renombrados: 0, errores: 0 },
        googleContacts: { actualizado: false, mensaje: 'No fue necesario actualizar.' }
    };

    // Obtener reserva desde PG para leer datos de cliente/canal
    const { rows: resRows } = await pool.query(
        'SELECT * FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2 LIMIT 1',
        [empresaId, idAntiguo]
    );
    if (!resRows[0]) throw new Error("La reserva principal no fue encontrada.");
    const reservaData = resRows[0];

    // Actualizar Google Contact si el cliente lo tiene sincronizado
    if (reservaData.cliente_id) {
        const { rows: cliRows } = await pool.query(
            'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2',
            [reservaData.cliente_id, empresaId]
        );
        const cliente = cliRows[0];
        if (cliente?.metadata?.googleContactSynced) {
            const { rows: canalRows } = await pool.query(
                'SELECT nombre FROM canales WHERE id = $1 AND empresa_id = $2',
                [reservaData.canal_id, empresaId]
            );
            const canalNuevoNombre = canalRows[0]?.nombre || reservaData.canal_nombre;
            const oldContactName = `${cliente.nombre} ${reservaData.canal_nombre} ${idAntiguo}`;
            const newContactData = { ...cliente, canalNombre: canalNuevoNombre, idReservaCanal: idNuevo };
            try {
                const result = await updateGoogleContact(db, empresaId, oldContactName, newContactData);
                summary.googleContacts.actualizado = result.status === 'updated' || result.status === 'created';
                summary.googleContacts.mensaje = `Contacto en Google ${result.status}.`;
            } catch (error) {
                summary.googleContacts.mensaje = `Error al actualizar en Google: ${error.message}`;
            }
        }
    }

    // Actualizar id_reserva_canal en PG (transacción atómica)
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const resUpd = await client.query(
            `UPDATE reservas SET id_reserva_canal = $1, updated_at = NOW()
             WHERE empresa_id = $2 AND id_reserva_canal = $3`,
            [idNuevo, empresaId, idAntiguo]
        );
        summary.postgres.reservas = resUpd.rowCount;

        const transUpd = await client.query(
            `UPDATE transacciones SET id_reserva_canal = $1
             WHERE empresa_id = $2 AND id_reserva_canal = $3`,
            [idNuevo, empresaId, idAntiguo]
        );
        summary.postgres.transacciones = transUpd.rowCount;

        const bitUpd = await client.query(
            `UPDATE bitacora SET id_reserva_canal = $1
             WHERE empresa_id = $2 AND id_reserva_canal = $3`,
            [idNuevo, empresaId, idAntiguo]
        );
        summary.postgres.bitacora = bitUpd.rowCount;

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Error en actualización en cascada: ${e.message}`);
    } finally {
        client.release();
    }

    // Renombrar archivos en Storage si los comprobantes contienen el ID antiguo
    const { rows: transRows } = await pool.query(
        `SELECT metadata->>'enlaceComprobante' AS enlace FROM transacciones
         WHERE empresa_id = $1 AND id_reserva_canal = $2`,
        [empresaId, idNuevo]
    );

    for (const t of transRows) {
        if (t.enlace && t.enlace.includes(idAntiguo)) {
            try {
                const nuevaUrl = await renameFileByUrl(t.enlace, idNuevo);
                if (nuevaUrl !== t.enlace) summary.storage.renombrados++;
            } catch {
                summary.storage.errores++;
            }
        }
    }

    return summary;
};

module.exports = { actualizarIdReservaCanalEnCascada };
