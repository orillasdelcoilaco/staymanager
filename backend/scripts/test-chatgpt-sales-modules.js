const assert = require('assert');
const { buildAmenidadesEstructuradas } = require('../services/chatgptSalesAmenidadesModule');
const { buildDescripcionComercialIa } = require('../services/chatgptSalesDescriptionModule');
const { buildImagenesEtiquetadas } = require('../services/chatgptSalesImagesModule');
const { buildTarifasDetalladas } = require('../services/chatgptSalesTarifasModule');
const { buildPoliticasHorariosIa } = require('../services/chatgptSalesPoliciesModule');
const { buildGeoComercialIa } = require('../services/chatgptSalesGeoModule');
const { buildFotoPrincipalVentas } = require('../services/chatgptSalesPrimaryImageModule');

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

    const tinajaTipo = buildImagenesEtiquetadas([
        { url: 'https://x/a.webp', alt: 'Tinaja', espacio: '', tipo_ia: 'tinaja', principal: false },
    ]);
    assert(tinajaTipo[0].tipo === 'tinaja', 'tinaja debe inferirse desde alt/tipo_ia');

    const ranked = buildImagenesEtiquetadas([
        { url: 'https://x/p.webp', alt: 'Estacionamiento', espacio: '', tipo_ia: 'general', principal: true },
        { url: 'https://x/t.webp', alt: 'Tinaja', espacio: '', tipo_ia: 'tinaja', principal: false },
    ]);
    const fp = buildFotoPrincipalVentas(ranked, { nombrePropiedad: 'Cabaña 8' });
    assert(fp && /tinaja/i.test(fp.alt), 'foto principal debe priorizar tinaja sobre estacionamiento');
    assert(fp.foto_principal_origen === 'auto_ranking_ventas', 'debe marcar origen auto cuando catálogo es débil');

    const tarifas = buildTarifasDetalladas({
        precio: { noche_referencia_clp: 120000, moneda: 'CLP' },
        precioEstimado: { total_estadia_clp: 240000 },
    });
    assert(tarifas.valor_noche >= 0, 'valor_noche invalido');

    const politicas = buildPoliticasHorariosIa({
        politicas: { hora_checkin: '15:00', hora_checkout: '11:00' },
        precioEstimado: { politica_cancelacion: { resumen: 'Gratis hasta 7 dias antes' } },
        amenidadesEstructuradas: { amenidades: ['pet_friendly'] },
        meta: {},
        empresaConfig: { websiteSettings: { booking: { chatgptMascotasPolicyMode: 'consultar_siempre', chatgptMascotasCondicion: 'Consultar por tipo y tamaño de mascota.' } } },
    });
    assert(politicas.cancelacion, 'cancelacion requerida');
    assert(politicas.mascotas === null, 'mascotas debe respetar modo consultar_siempre');
    assert(politicas.mascotas_condicion, 'mascotas_condicion requerida');

    const geo = buildGeoComercialIa({
        ubicacion: { lat: -39.2, lng: -71.8, ciudad: 'Pucon' },
        meta: {},
        contextoTuristico: { destacados: ['Termas cercanas', 'Rutas de trekking'] },
    });
    assert(geo.lat != null && geo.lng != null, 'lat/lng requeridos');
    assert(Array.isArray(geo.pois), 'pois debe ser arreglo');

    console.log('ok chatgpt-sales-modules');
}

run();

