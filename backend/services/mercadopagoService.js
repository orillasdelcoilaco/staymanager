const { MercadoPagoConfig, Preference } = require('mercadopago');

const crearPreferencia = async (empresaId, reservaId, titulo, precioUnitario, moneda = 'CLP') => {
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
        console.warn('[MercadoPago] MP_ACCESS_TOKEN no configurado. Usando modo MOCK.');
        return `https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=MOCK-${reservaId}`;
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: accessToken });
        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: [
                    {
                        title: titulo,
                        quantity: 1,
                        unit_price: precioUnitario,
                        currency_id: moneda
                    }
                ],
                external_reference: reservaId,
                back_urls: {
                    success: "https://tucabana.cl/reserva/exito", // TODO: Configurar URL real
                    failure: "https://tucabana.cl/reserva/fallo",
                    pending: "https://tucabana.cl/reserva/pendiente"
                },
                auto_return: "approved",
            }
        });

        return result.init_point;
    } catch (error) {
        console.error('[MercadoPago] Error al crear preferencia:', error);
        throw new Error('Error al generar link de pago.');
    }
};

module.exports = {
    crearPreferencia
};
