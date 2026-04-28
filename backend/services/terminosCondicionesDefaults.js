/**
 * Plantillas y merge de `websiteSettings.terminosCondiciones` (SSR + panel).
 * Textos modelo estilo OTA / gestión de alojamiento; el anfitrión debe revisar con asesoría legal si aplica.
 */

const SECCION_KEYS = [
    'introduccion',
    'usoInformacion',
    'consentimientoDatosResenas',
    'reservasPagos',
    'seguridadNormasUso',
    'conductaAreasComunes',
    'menoresMascotasPrivacidad',
    'operadorLeyAplicable',
];

const TITULOS_DEFAULT = {
    introduccion: 'Alcance y aceptación',
    usoInformacion: 'Uso de la información personal',
    consentimientoDatosResenas: 'Consentimiento, comunicaciones y reseñas',
    reservasPagos: 'Reservas, pagos y políticas de cancelación',
    seguridadNormasUso: 'Seguridad y normas de uso de las instalaciones',
    conductaAreasComunes: 'Conducta, áreas comunes y daños',
    menoresMascotasPrivacidad: 'Menores, mascotas y privacidad',
    operadorLeyAplicable: 'Operador del servicio y ley aplicable',
};

const TITULOS_DEFAULT_EN = {
    introduccion: 'Scope and acceptance',
    usoInformacion: 'Use of personal information',
    consentimientoDatosResenas: 'Consent, communications and reviews',
    reservasPagos: 'Bookings, payments and cancellation',
    seguridadNormasUso: 'Safety and facility rules',
    conductaAreasComunes: 'Conduct, shared areas and damage',
    menoresMascotasPrivacidad: 'Children, pets and privacy',
    operadorLeyAplicable: 'Operator and governing law',
};

/** HTML modelo: prácticas tipo Booking/Airbnb/Expedia adaptadas + ejemplos de gestión (piscina, mascotas, depósito). */
const HTML_DEFAULT = {
    introduccion: `<p>Al reservar o utilizar los alojamientos gestionados a través de este sitio, usted acepta estos términos y condiciones en su versión publicada en la fecha de la reserva. Si no está de acuerdo, no debe completar la reserva.</p>
<p>Los servicios de alojamiento son prestados por el operador indicado al final de este documento (o en la confirmación de reserva). La plataforma de reservas actúa como canal de contratación salvo que se indique lo contrario.</p>`,

    usoInformacion: `<p>Tratamos los datos personales (nombre, contacto, datos de pago cuando corresponda, preferencias de estancia) con fines de: (1) gestionar su reserva y estadía; (2) cumplir obligaciones legales; (3) seguridad y prevención de fraude; (4) mejora del servicio.</p>
<p>No vendemos sus datos a terceros. Podemos utilizar proveedores de confianza (por ejemplo, pasarela de pago, envío de correo, alojamiento web) bajo contratos que limitan el uso de la información.</p>
<p>Puede solicitar acceso, rectificación o supresión cuando la ley aplicable lo permita, contactando al operador con los datos publicados en este sitio.</p>`,

    consentimientoDatosResenas: `<p><strong>Reseñas y reputación:</strong> Tras su estadía, podremos invitarle a valorar la experiencia. Si publica una reseña en este sitio o en integraciones conectadas (por ejemplo, Google, Tripadvisor u otras), usted concede una licencia no exclusiva para reproducir, mostrar y traducir dicho contenido en relación con la promoción del alojamiento.</p>
<p><strong>Comunicaciones:</strong> Podremos enviarle correos transaccionales (confirmación, modificación, recordatorios) y, si la ley lo permite y usted no se ha opuesto donde corresponda, comunicaciones comerciales relacionadas con su reserva o con estancias similares.</p>
<p>Puede darse de baja de mensajes promocionales según el enlace o instrucciones incluidos en cada envío, sin perjuicio de los correos necesarios para ejecutar su reserva.</p>`,

    reservasPagos: `<p>Todas las reservas están sujetas a disponibilidad real del alojamiento. Los precios mostrados se calculan según las tarifas y condiciones vigentes en el momento de la contratación; el detalle aparecerá antes de confirmar.</p>
<p><strong>Depósito o pago inicial:</strong> Para garantizar la reserva puede exigirse un abono (porcentaje o monto fijo) según lo indicado en el proceso de reserva o en el correo de confirmación. Si no se recibe el pago en el plazo indicado, la reserva podrá ser anulada automáticamente.</p>
<p><strong>Saldo:</strong> El pago del saldo restante deberá realizarse conforme a lo acordado en la confirmación (por ejemplo, antes del check-in o en el momento de la llegada), salvo acuerdo escrito distinto con el operador.</p>
<p><strong>Cancelación:</strong> Se aplicará la política de cancelación publicada en el sitio en el momento de la reserva (incluidos plazos de reembolso o penalidades). Las políticas pueden variar según tarifa o temporada.</p>
<p><strong>Derecho de admisión y permanencia:</strong> El operador podrá denegar o finalizar la estadía en caso de incumplimiento grave de estas normas, conductas que afecten la seguridad o convivencia, o información falsa relevante para la reserva, conforme a la ley aplicable.</p>`,

    seguridadNormasUso: `<p><strong>Menores:</strong> Los menores de edad deben estar bajo la supervisión permanente de un adulto responsable, en especial en zonas con agua (piscina, río, lago) y áreas de juego.</p>
<p><strong>Zonas acuáticas:</strong> Salvo señalización y reglas específicas del alojamiento, el uso de piscinas o similares es bajo su propia responsabilidad. Si no hay salvavidas, el baño es exclusivamente bajo su cuidado y el de los menores a su cargo. Respete las prohibiciones locales (por ejemplo, baño en corrientes peligrosas) cuando existan.</p>
<p><strong>Emergencias:</strong> Ante sismo, incendio u otra emergencia, siga las instrucciones del personal y los puntos de reunión indicados en el alojamiento.</p>
<p><strong>Daños:</strong> Cualquier deterioro imputable al huésped o a sus acompañantes podrá ser reclamado conforme a la ley y a la documentación de la reserva.</p>`,

    conductaAreasComunes: `<p>Se espera un comportamiento respetuoso hacia vecinos y otros huéspedes. Horario de silencio o reducción de ruidos según lo indicado en el alojamiento (típicamente entre la noche y la mañana).</p>
<p><strong>Áreas comunes:</strong> Parrillas, mobiliario de exterior u otros elementos deben usarse solo en las zonas permitidas. No está permitido desplazar mobiliario de las unidades hacia zonas no autorizadas.</p>
<p><strong>Sustancias ilegales:</strong> Queda prohibido el consumo, distribución o posesión de drogas ilegales. Cualquier actividad ilícita podrá ser reportada a las autoridades y dar lugar a la terminación inmediata de la estadía sin reembolso.</p>
<p><strong>Fiestas y visitas:</strong> Eventos o reuniones con personas no registradas pueden requerir autorización previa por escrito del operador.</p>`,

    menoresMascotasPrivacidad: `<p><strong>Mascotas:</strong> La admisión de animales depende de la configuración del alojamiento y de las normas publicadas. Cuando se permitan, el titular es responsable del comportamiento, ruidos y daños; puede exigirse tamaño o número máximo de mascotas. Incidentes imputables al animal pueden generar cargos conforme a la normativa aplicable (por ejemplo, responsabilidad del dueño en Chile).</p>
<p><strong>Capacidad:</strong> El número de huéspedes no puede superar el máximo contratado. El incumplimiento puede motivar la denegación de entrada o la terminación de la estadía sin derecho a reembolso, según política publicada.</p>
<p><strong>Privacidad entre huéspedes:</strong> Respete la intimidad de otras personas; no filmar ni fotografiar en zonas comunes a terceros sin consentimiento.</p>`,

    operadorLeyAplicable: `<p>Los alojamientos y servicios asociados son ofrecidos por el operador identificado en la confirmación de reserva y en los datos de contacto de este sitio.</p>
<p>Salvo disposición imperativa en contrario, las relaciones se regirán por las leyes de la República de Chile. Para controversias, las partes podrán someterse a los tribunales ordinarios del domicilio del consumidor o del operador según corresponda conforme a la ley aplicable.</p>
<p><strong>Actualizaciones:</strong> El operador podrá actualizar estos términos; la versión aplicable a su reserva es la publicada al momento de la contratación, salvo cambios exigidos por ley o de seguridad que deban aplicarse de inmediato.</p>`,
};

/** English mirror (OTA-style); same legal disclaimer applies. */
const HTML_DEFAULT_EN = {
    introduccion: `<p>By booking or using the accommodations offered through this site, you accept these terms as published on the booking date. If you do not agree, you must not complete the reservation.</p>
<p>Accommodation services are provided by the operator identified in your confirmation (or on this site). The booking channel facilitates the contract unless stated otherwise.</p>`,

    usoInformacion: `<p>We process personal data (name, contact details, payment data where applicable, stay preferences) to: (1) manage your booking and stay; (2) meet legal obligations; (3) security and fraud prevention; (4) service improvement.</p>
<p>We do not sell your data. We may use trusted processors (e.g. payment gateway, email, hosting) under agreements that restrict use of information.</p>
<p>Where applicable law allows, you may request access, rectification or erasure by contacting the operator using the details published on this site.</p>`,

    consentimientoDatosResenas: `<p><strong>Reviews:</strong> After your stay we may invite you to rate your experience. If you post a review on this site or connected platforms (e.g. Google, Tripadvisor), you grant a non-exclusive licence to reproduce, display and translate that content to promote the property.</p>
<p><strong>Communications:</strong> We may send transactional emails (confirmation, changes, reminders) and, where permitted and unless you opt out as required, marketing related to your booking or similar stays.</p>
<p>You can unsubscribe from promotional messages using the link or instructions in each email, without affecting messages necessary to fulfil your booking.</p>`,

    reservasPagos: `<p>All bookings are subject to real-time availability. Prices follow the rates and conditions in force at checkout; details are shown before you confirm.</p>
<p><strong>Deposit or prepayment:</strong> A deposit (percentage or fixed amount) may be required as shown at checkout or in the confirmation email. If payment is not received within the stated deadline, the booking may be cancelled automatically.</p>
<p><strong>Balance:</strong> The remaining balance must be paid as stated in your confirmation (e.g. before check-in or on arrival), unless otherwise agreed in writing with the operator.</p>
<p><strong>Cancellation:</strong> The cancellation policy published at booking time applies (including refund windows or penalties). Policies may vary by rate or season.</p>
<p><strong>Right of admission:</strong> The operator may refuse or end a stay for serious breach of these rules, safety or community issues, or material misrepresentation, in line with applicable law.</p>`,

    seguridadNormasUso: `<p><strong>Children:</strong> Minors must be supervised at all times by a responsible adult, especially around water (pool, river, lake) and play areas.</p>
<p><strong>Water features:</strong> Unless specific signage and rules apply, use of pools or similar is at your own risk. Where no lifeguard is on duty, swimming is entirely under your supervision and that of minors in your care. Observe any local prohibitions (e.g. unsafe currents).</p>
<p><strong>Emergencies:</strong> In case of earthquake, fire or other emergency, follow staff instructions and assembly points posted at the property.</p>
<p><strong>Damage:</strong> Damage attributable to you or your guests may be charged in accordance with law and your booking documentation.</p>`,

    conductaAreasComunes: `<p>Please behave respectfully towards neighbours and other guests. Quiet hours or noise reduction may apply as indicated (typically overnight).</p>
<p><strong>Shared areas:</strong> Barbecues, outdoor furniture or equipment must be used only in designated areas. Do not move indoor furniture to unauthorised outdoor or other-unit areas.</p>
<p><strong>Illegal substances:</strong> Use, distribution or possession of illegal drugs is prohibited. Unlawful activity may be reported to authorities and may result in immediate termination of the stay without refund.</p>
<p><strong>Parties and visitors:</strong> Events or gatherings with people not on the booking may require prior written approval from the operator.</p>`,

    menoresMascotasPrivacidad: `<p><strong>Pets:</strong> Pet acceptance depends on the listing configuration and published rules. Where allowed, the owner is responsible for behaviour, noise and damage; size or number limits may apply. Incidents attributable to the pet may incur charges under applicable law (e.g. owner liability).</p>
<p><strong>Capacity:</strong> Guest count must not exceed the maximum booked. Breach may result in refused entry or termination without refund, per published policy.</p>
<p><strong>Privacy:</strong> Respect other guests’ privacy; do not film or photograph third parties in shared areas without consent.</p>`,

    operadorLeyAplicable: `<p>Accommodation and related services are offered by the operator identified in your confirmation and on this site’s contact details.</p>
<p>Unless mandatory law provides otherwise, relationships are governed by the laws of the Republic of Chile. Disputes may be brought before the competent courts as applicable consumer law requires.</p>
<p><strong>Updates:</strong> The operator may update these terms; the version that applies to your booking is the one published at contract time, except legally or safety-required changes that must apply immediately.</p>`,
};

function emptySeccion(key) {
    return {
        titulo: TITULOS_DEFAULT[key] || key,
        html: '',
    };
}

function emptySeccionEn(key) {
    return {
        titulo: TITULOS_DEFAULT_EN[key] || key,
        html: '',
    };
}

function buildDefaultSeccionesEn() {
    const seccionesEn = {};
    for (const key of SECCION_KEYS) {
        seccionesEn[key] = {
            titulo: TITULOS_DEFAULT_EN[key],
            html: HTML_DEFAULT_EN[key] || '',
        };
    }
    return seccionesEn;
}

function createDefaultTerminosCondiciones() {
    const secciones = {};
    for (const key of SECCION_KEYS) {
        secciones[key] = {
            titulo: TITULOS_DEFAULT[key],
            html: HTML_DEFAULT[key] || '',
        };
    }
    return {
        plantillaVersion: 'ota-v1-2026-04',
        publicado: false,
        tituloPagina: 'Términos y condiciones',
        tituloPaginaEn: 'Terms and conditions',
        secciones,
        seccionesEn: buildDefaultSeccionesEn(),
    };
}

/**
 * @param {object|null|undefined} existing
 * @param {object|null|undefined} incoming — parcial desde el panel
 */
function mergeTerminosCondiciones(existing, incoming) {
    const base = existing && typeof existing === 'object'
        ? JSON.parse(JSON.stringify(existing))
        : createDefaultTerminosCondiciones();
    if (!incoming || typeof incoming !== 'object') return base;

    if (typeof incoming.publicado === 'boolean') base.publicado = incoming.publicado;
    if (incoming.tituloPagina != null && String(incoming.tituloPagina).trim()) {
        base.tituloPagina = String(incoming.tituloPagina).trim().slice(0, 200);
    }
    if (incoming.plantillaVersion != null) {
        base.plantillaVersion = String(incoming.plantillaVersion).slice(0, 64);
    }
    if (incoming.tituloPaginaEn != null && String(incoming.tituloPaginaEn).trim()) {
        base.tituloPaginaEn = String(incoming.tituloPaginaEn).trim().slice(0, 200);
    } else if (base.tituloPaginaEn == null || !String(base.tituloPaginaEn).trim()) {
        base.tituloPaginaEn = 'Terms and conditions';
    }

    const incSec = incoming.secciones && typeof incoming.secciones === 'object' ? incoming.secciones : {};
    base.secciones = base.secciones && typeof base.secciones === 'object' ? base.secciones : {};
    for (const key of SECCION_KEYS) {
        const cur = base.secciones[key] && typeof base.secciones[key] === 'object' ? base.secciones[key] : emptySeccion(key);
        const add = incSec[key] && typeof incSec[key] === 'object' ? incSec[key] : {};
        const titulo = add.titulo != null && String(add.titulo).trim()
            ? String(add.titulo).trim().slice(0, 200)
            : cur.titulo;
        const html = add.html != null ? String(add.html).slice(0, 200000) : cur.html;
        base.secciones[key] = { titulo, html };
    }

    if (!base.seccionesEn || typeof base.seccionesEn !== 'object') {
        base.seccionesEn = buildDefaultSeccionesEn();
    }
    const incSecEn = incoming.seccionesEn && typeof incoming.seccionesEn === 'object' ? incoming.seccionesEn : {};
    for (const key of SECCION_KEYS) {
        const cur = base.seccionesEn[key] && typeof base.seccionesEn[key] === 'object' ? base.seccionesEn[key] : emptySeccionEn(key);
        const add = incSecEn[key] && typeof incSecEn[key] === 'object' ? incSecEn[key] : {};
        const titulo = add.titulo != null && String(add.titulo).trim()
            ? String(add.titulo).trim().slice(0, 200)
            : cur.titulo;
        const html = add.html != null ? String(add.html).slice(0, 200000) : cur.html;
        base.seccionesEn[key] = { titulo, html };
    }

    return base;
}

module.exports = {
    SECCION_KEYS,
    TITULOS_DEFAULT,
    TITULOS_DEFAULT_EN,
    createDefaultTerminosCondiciones,
    mergeTerminosCondiciones,
};
