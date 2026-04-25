const assert = require('assert');
const { buildAmenidadesEstructuradas } = require('../services/chatgptSalesAmenidadesModule');
const { buildDescripcionComercialIa } = require('../services/chatgptSalesDescriptionModule');
const { buildImagenesEtiquetadas } = require('../services/chatgptSalesImagesModule');
const { buildTarifasDetalladas } = require('../services/chatgptSalesTarifasModule');
const { buildPoliticasHorariosIa } = require('../services/chatgptSalesPoliciesModule');
const { buildGeoComercialIa } = require('../services/chatgptSalesGeoModule');

function run() {
    const meta = {
        amenidades: ['WiFi', 'Tinaja privada', 'Pet friendly'],
        componentes: [{ inventarioVerificado: [{ description: 'Cama matrimonial', quantity: 2 }] }],
        contextoComercial: { descripcion_corta: 'Cabana familiar', tono: 'familiar' },
    };
    const row = { nombre: 'Cabana 7', descripcion: 'Con vista al rio', capacidad: 5 };

    const amen = buildAmenidadesEstructuradas({ row, meta, distribucion: { dormitorios: 2, banos: 1 } });
    assert(Array.isArray(amen.amenidades), 'amenidades debe ser arreglo');
    assert(amen.atributos && typeof amen.atributos === 'object', 'atributos debe existir');

    const desc = buildDescripcionComercialIa({
        row,
        meta,
        descripcionBase: 'Descripcion base',
        contextoTuristico: { tipo_viaje: ['familias'] },
        amenidadesEstructuradas: amen,
    });
    assert(desc.descripcion_corta, 'descripcion_corta requerida');
    assert(desc.tono, 'tono requerido');

    const imgs = buildImagenesEtiquetadas([{ url: 'https://x/y.jpg', alt: 'Dormitorio principal', principal: true }]);
    assert(imgs[0].tipo, 'tipo imagen requerido');

    const tarifas = buildTarifasDetalladas({
        precio: { noche_referencia_clp: 120000, moneda: 'CLP' },
        precioEstimado: { total_estadia_clp: 240000 },
    });
    assert(tarifas.valor_noche >= 0, 'valor_noche invalido');

    const politicas = buildPoliticasHorariosIa({
        politicas: { hora_checkin: '15:00', hora_checkout: '11:00' },
        precioEstimado: { politica_cancelacion: { resumen: 'Gratis hasta 7 dias antes' } },
    });
    assert(politicas.cancelacion, 'cancelacion requerida');

    const geo = buildGeoComercialIa({
        ubicacion: { lat: -39.2, lng: -71.8, ciudad: 'Pucon' },
        meta: {},
    });
    assert(geo.lat != null && geo.lng != null, 'lat/lng requeridos');

    console.log('ok chatgpt-sales-modules');
}

run();

