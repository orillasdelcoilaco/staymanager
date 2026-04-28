const assert = require('assert');
const {
    parseValoresReservaRow,
    precioFinalDesdeReservaPgRow,
} = require('../services/reservaRowValores');

assert.deepStrictEqual(parseValoresReservaRow(null), {});
assert.deepStrictEqual(parseValoresReservaRow(''), {});
assert.deepStrictEqual(parseValoresReservaRow('not-json'), {});
assert.deepStrictEqual(parseValoresReservaRow('{"valorHuesped":125000}'), { valorHuesped: 125000 });
assert.deepStrictEqual(parseValoresReservaRow({ valorHuesped: 99000 }), { valorHuesped: 99000 });

let p = precioFinalDesdeReservaPgRow({ valores: { valorHuesped: 100 } }, {});
assert.strictEqual(p, 100);

p = precioFinalDesdeReservaPgRow({ valores: '{"valorHuesped":200}' }, {});
assert.strictEqual(p, 200);

p = precioFinalDesdeReservaPgRow({ valores: {} }, { precioCheckoutVerificado: { precioEnviadoCLP: 300 } });
assert.strictEqual(p, 300);

p = precioFinalDesdeReservaPgRow({ valores: '{}' }, { precioCheckoutVerificado: { totalEsperadoCLP: 400 } });
assert.strictEqual(p, 400);

console.log('test-confirmacion-valores-parse: OK');
