const assert = require('assert');
const { bookingKeyByTenantIpEmail } = require('../middleware/publicApiSecurity');

const reqA = {
    ip: '1.2.3.4',
    body: {
        empresa_id: 'CV1Lb4HLBLvWvSyqYfRW',
        huesped: { email: 'Cliente@Mail.com' },
    },
};
const keyA = bookingKeyByTenantIpEmail(reqA);
assert.strictEqual(keyA, '1.2.3.4|cv1lb4hlblvwvsyqyfrw|cliente@mail.com');

const reqB = {
    ip: '1.2.3.4',
    body: { empresaId: 'empresa-x', cliente: { email: 'foo@bar.com' } },
};
const keyB = bookingKeyByTenantIpEmail(reqB);
assert.strictEqual(keyB, '1.2.3.4|empresa-x|foo@bar.com');

const reqC = {
    ip: '8.8.8.8',
    body: {},
};
const keyC = bookingKeyByTenantIpEmail(reqC);
assert.strictEqual(keyC, '8.8.8.8|sin-empresa|sin-email');

console.log('test-public-api-rate-limit-key: OK');
