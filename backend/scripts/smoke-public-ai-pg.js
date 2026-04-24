require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { lookupEmpresaForAgentQuery } = require('../services/agentEmpresaLookupService');
const { fetchGlobalPublicAiInventoryPostgres } = require('../services/publicAiInventoryPg');

(async () => {
    const a = await lookupEmpresaForAgentQuery('prueba 1');
    const b = await lookupEmpresaForAgentQuery('prueba1');
    console.log('lookup prueba 1', a);
    console.log('lookup prueba1', b);
    const inv = await fetchGlobalPublicAiInventoryPostgres({
        fechaLlegada: '2026-04-24',
        fechaSalida: '2026-04-26',
        checkin: '2026-04-24',
        checkout: '2026-04-26',
        limit: 10,
    });
    console.log('inventory total', inv.meta.total, 'page', inv.data.length);
    await require('../db/postgres').end();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
