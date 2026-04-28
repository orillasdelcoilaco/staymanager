/**

 * node backend/scripts/test-politica-cancelacion-tarifa.js

 */

const assert = require('assert');

const { parseISO } = require('date-fns');

const {

    listTarifaIdsPorNocheEstadia,

    mergeLegalConPoliticaTarifaUnica,

    listarBloquesPoliticaCancelacionLargoDistintosAlPrincipal,

    snapshotPoliticaCancelacionParaMetadata,

} = require('../services/politicaCancelacionTarifaService');



const d0 = parseISO('2026-06-01T12:00:00Z');

const d1 = parseISO('2026-08-31T12:00:00Z');

const all = [

    {

        id: 't1',

        alojamientoId: 'p1',

        fechaInicio: d0,

        fechaTermino: d1,

        metadata: {

            politicaCancelacion: { modo: 'gratis_hasta_horas', horasGratis: 72 },

        },

    },

];



const ids = listTarifaIdsPorNocheEstadia('p1', '2026-07-10', '2026-07-13', all);

assert.strictEqual(ids.length, 3);

assert.ok(ids.every((id) => id === 't1'));



const legal = { politicaCancelacionModo: 'gratis_hasta_horas', politicaCancelacionHorasGratis: 24 };

const merged = mergeLegalConPoliticaTarifaUnica(legal, all, ids);

assert.strictEqual(merged.politicaCancelacionHorasGratis, 72);



const allDos = [

    ...all,

    {

        id: 't2',

        alojamientoId: 'p1',

        fechaInicio: d0,

        fechaTermino: d1,

        metadata: {

            politicaCancelacion: { modo: 'gratis_hasta_horas', horasGratis: 24 },

        },

    },

];

const mergedMixHoras = mergeLegalConPoliticaTarifaUnica(legal, allDos, ['t1', 't2', 't1']);

assert.strictEqual(mergedMixHoras.politicaCancelacionModo, 'gratis_hasta_horas');

assert.strictEqual(mergedMixHoras.politicaCancelacionHorasGratis, 72, 'mayoría de noches → política de la tarifa dominante');

const merged50 = mergeLegalConPoliticaTarifaUnica(legal, allDos, ['t1', 't2']);

assert.strictEqual(merged50.politicaCancelacionHorasGratis, 24, 'empate 50–50 → restrictivo (mínimo horas)');



const allTexto = [

    ...allDos,

    {

        id: 't3',

        alojamientoId: 'p1',

        fechaInicio: d0,

        fechaTermino: d1,

        metadata: {

            politicaCancelacion: { modo: 'texto_solo' },

        },

    },

];

const mergedTexto = mergeLegalConPoliticaTarifaUnica(legal, allTexto, ['t1', 't3']);

assert.strictEqual(mergedTexto.politicaCancelacionModo, 'texto_solo');



const allLim = [

    {

        id: 'ta',

        alojamientoId: 'p1',

        fechaInicio: d0,

        fechaTermino: d1,

        metadata: { politicaCancelacion: { modo: 'gratis_ilimitada' } },

    },

    {

        id: 'tb',

        alojamientoId: 'p1',

        fechaInicio: d0,

        fechaTermino: d1,

        metadata: { politicaCancelacion: { modo: 'gratis_ilimitada' } },

    },

];

const mergedLim = mergeLegalConPoliticaTarifaUnica(legal, allLim, ['ta', 'tb']);

assert.strictEqual(mergedLim.politicaCancelacionModo, 'gratis_ilimitada');



const mergedLimYHoras = mergeLegalConPoliticaTarifaUnica(legal, [...allLim, ...allDos], ['ta', 't2']);

assert.strictEqual(mergedLimYHoras.politicaCancelacionModo, 'gratis_hasta_horas');

assert.strictEqual(mergedLimYHoras.politicaCancelacionHorasGratis, 24);



const snap = snapshotPoliticaCancelacionParaMetadata(merged);

assert.strictEqual(snap.politicaCancelacionModo, 'gratis_hasta_horas');

assert.strictEqual(snap.politicaCancelacionHorasGratis, 72);

const legalHtml = {
    politicaCancelacionModo: 'gratis_hasta_horas',
    politicaCancelacionHorasGratis: 24,
    politicaCancelacionHtml: '<p>empresa</p>',
};
const allConLargo = [
    {
        id: 'tx',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_hasta_horas',
                horasGratis: 48,
                politicaCancelacionHtml: '<p>tarifa</p>',
            },
        },
    },
];
const mergedLargo = mergeLegalConPoliticaTarifaUnica(legalHtml, allConLargo, ['tx', 'tx', 'tx']);
assert.strictEqual(mergedLargo.politicaCancelacionHorasGratis, 48);
assert.strictEqual(mergedLargo.politicaCancelacionHtml, '<p>tarifa</p>');
const snapL = snapshotPoliticaCancelacionParaMetadata(mergedLargo);
assert.strictEqual(snapL.politicaCancelacionHtml, '<p>tarifa</p>');

const allConfLargo = [
    {
        id: 'ca',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_ilimitada',
                politicaCancelacionHtml: '<p>A</p>',
            },
        },
    },
    {
        id: 'cb',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_ilimitada',
                politicaCancelacionHtml: '<p>B</p>',
            },
        },
    },
];
const mergedConf = mergeLegalConPoliticaTarifaUnica(legalHtml, allConfLargo, ['ca', 'cb']);
assert.strictEqual(mergedConf.politicaCancelacionModo, 'gratis_ilimitada');
assert.strictEqual(mergedConf.politicaCancelacionHtml, '<p>empresa</p>');

const allMismoLargo = [
    {
        id: 'm1',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_ilimitada',
                politicaCancelacionHtml: '<p>único</p>',
            },
        },
    },
    {
        id: 'm2',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_ilimitada',
                politicaCancelacionHtml: '<p>único</p>',
            },
        },
    },
];
const mergedMismo = mergeLegalConPoliticaTarifaUnica(legalHtml, allMismoLargo, ['m1', 'm2']);
assert.strictEqual(mergedMismo.politicaCancelacionHtml, '<p>único</p>');

const allDom = [
    {
        id: 'd1',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_hasta_horas',
                horasGratis: 96,
                politicaCancelacionHtml: '<p>Gana</p>',
            },
        },
    },
    {
        id: 'd2',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            politicaCancelacion: {
                modo: 'gratis_hasta_horas',
                horasGratis: 12,
                politicaCancelacionHtml: '<p>Pierde</p>',
            },
        },
    },
];
const mergedDom = mergeLegalConPoliticaTarifaUnica(legalHtml, allDom, ['d1', 'd1', 'd2']);
assert.strictEqual(mergedDom.politicaCancelacionHorasGratis, 96);
assert.strictEqual(mergedDom.politicaCancelacionHtml, '<p>Gana</p>');
const bloquesDom = listarBloquesPoliticaCancelacionLargoDistintosAlPrincipal(allDom, ['d1', 'd1', 'd2'], mergedDom);
assert.strictEqual(bloquesDom.length, 1);
assert.strictEqual(bloquesDom[0].html, '<p>Pierde</p>');
assert.strictEqual(bloquesDom[0].noches, 1);
assert.strictEqual(bloquesDom[0].totalNoches, 3);
assert.deepStrictEqual(bloquesDom[0].tarifaIds, ['d2']);
assert.strictEqual(bloquesDom[0].etiqueta, '', 'sin metadata.nombre/etiqueta: etiqueta vacía (UI usa copy genérico)');

const allDomNom = [
    {
        id: 'n1',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            nombre: 'Verano',
            politicaCancelacion: {
                modo: 'gratis_ilimitada',
                politicaCancelacionHtml: '<p>X</p>',
            },
        },
    },
    {
        id: 'n2',
        alojamientoId: 'p1',
        fechaInicio: d0,
        fechaTermino: d1,
        metadata: {
            nombre: 'Invierno',
            politicaCancelacion: {
                modo: 'gratis_ilimitada',
                politicaCancelacionHtml: '<p>Y</p>',
            },
        },
    },
];
const mergedNom = mergeLegalConPoliticaTarifaUnica(legalHtml, allDomNom, ['n1', 'n2']);
const bloquesNom = listarBloquesPoliticaCancelacionLargoDistintosAlPrincipal(allDomNom, ['n1', 'n2'], mergedNom);
assert.strictEqual(bloquesNom.length, 2);
const etiquetasNom = bloquesNom.map((b) => b.etiqueta).sort();
assert.deepStrictEqual(etiquetasNom, ['Invierno', 'Verano']);

console.log('politicaCancelacionTarifaService: OK');


