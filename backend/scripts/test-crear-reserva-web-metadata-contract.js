/**
 * Contrato mínimo de `metadata` y respuesta creación reserva web (smoke §2 ítem 4, sin PG).
 * La inserción real sigue en `publicWebsiteService.crearReservaPublica` + `website.booking.js` (201).
 */
const assert = require('assert');
const { snapshotPoliticaCancelacionParaMetadata } = require('../services/politicaCancelacionTarifaService');

function assertShape(meta) {
    assert.strictEqual(meta.origen, 'website');
    assert.ok(meta.edicionesManuales && typeof meta.edicionesManuales === 'object');
    const pol = meta.politicaCancelacionCheckout;
    assert.ok(pol && typeof pol === 'object', 'politicaCancelacionCheckout');
    assert.ok(String(pol.politicaCancelacionModo || '').length > 0, 'modo');
    assert.ok(Number.isFinite(Number(pol.politicaCancelacionHorasGratis)), 'horas');
}

const snap = snapshotPoliticaCancelacionParaMetadata({
    politicaCancelacionModo: 'gratis_hasta_horas',
    politicaCancelacionHorasGratis: 48,
});
assert.strictEqual(snap.politicaCancelacionModo, 'gratis_hasta_horas');
assert.strictEqual(snap.politicaCancelacionHorasGratis, 48);

const metaBase = {
    origen: 'website',
    edicionesManuales: {},
    politicaCancelacionCheckout: snap,
    precioCheckoutVerificado: {
        precioEnviadoCLP: 150000,
        totalEsperadoCLP: 150000,
        noches: 3,
        verificadoAt: new Date().toISOString(),
    },
};
assertShape(metaBase);
const roundTrip = JSON.parse(JSON.stringify(metaBase));
assertShape(roundTrip);

const metaMenores = {
    ...metaBase,
    reservaWebCheckout: { menores: 1, camasExtra: 0, recargoCLP: 5000 },
};
assertShape(metaMenores);
assert.strictEqual(metaMenores.reservaWebCheckout.menores, 1);

const metaSoloHora = {
    ...metaBase,
    reservaWebCheckout: { horaLlegadaEstimada: 'Llegada ~22:00' },
};
assertShape(metaSoloHora);
assert.strictEqual(metaSoloHora.reservaWebCheckout.horaLlegadaEstimada, 'Llegada ~22:00');

const metaLlegadaLigera = {
    ...metaBase,
    reservaWebCheckout: {
        medioLlegada: 'avion',
        referenciaTransporte: 'LA800',
        documentoRefViajero: 'ABC12',
    },
};
assertShape(metaLlegadaLigera);
assert.strictEqual(metaLlegadaLigera.reservaWebCheckout.medioLlegada, 'avion');
assert.strictEqual(metaLlegadaLigera.reservaWebCheckout.referenciaTransporte, 'LA800');
assert.strictEqual(metaLlegadaLigera.reservaWebCheckout.documentoRefViajero, 'ABC12');

const metaComentarios = {
    ...metaBase,
    reservaWebCheckout: { comentariosHuesped: 'Llegamos tarde, gracias.' },
};
assertShape(metaComentarios);
assert.strictEqual(metaComentarios.reservaWebCheckout.comentariosHuesped, 'Llegamos tarde, gracias.');

const metaCheckin = {
    ...metaBase,
    reservaWebCheckout: {
        checkInIdentidad: {
            documentoTipo: 'rut',
            documentoNumero: '12345678-9',
            nacionalidad: 'CL',
            fechaNacimiento: '1991-03-20',
        },
        checkInIdentidadAceptacion: {
            aceptadoAt: new Date().toISOString(),
            politicaVersion: 'checkin-identidad-v1',
        },
    },
};
assertShape(metaCheckin);
assert.strictEqual(metaCheckin.reservaWebCheckout.checkInIdentidad.documentoTipo, 'rut');
assert.ok(metaCheckin.reservaWebCheckout.checkInIdentidadAceptacion.aceptadoAt);
assert.strictEqual(metaCheckin.reservaWebCheckout.checkInIdentidadAceptacion.politicaVersion, 'checkin-identidad-v1');

const metaGrupo = {
    ...metaBase,
    reservaWebGrupo: { propiedadIds: ['a', 'b'], alojamientosNombres: ['Cabaña A', 'Cabaña B'] },
};
assertShape(metaGrupo);
assert.strictEqual(metaGrupo.reservaWebGrupo.propiedadIds.length, 2);

console.log('test-crear-reserva-web-metadata-contract: OK');
