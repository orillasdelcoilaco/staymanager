// backend/services/googleHotelsService.js
const pool = require('../db/postgres');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { getAvailabilityData } = require('./propuestasService');

// Función para escapar caracteres XML (sin cambios)
const escapeXml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
};

const generatePropertyListFeed = async (_db, empresaId) => {
    const propiedades = await obtenerPropiedadesPorEmpresa(null, empresaId);
    const propiedadesListadas = propiedades.filter(p => p.googleHotelData && p.googleHotelData.isListed && p.googleHotelData.hotelId);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<Transaction timestamp="${new Date().toISOString()}" id="initial-listing">\n`;
    xml += `  <Result>\n`;
    
    propiedadesListadas.forEach(prop => {
        xml += `    <Property id="${escapeXml(prop.googleHotelData.hotelId)}">\n`;
        xml += `      <Name>${escapeXml(prop.nombre)}</Name>\n`;
        if (prop.googleHotelData.address) {
            xml += `      <Address>\n`;
            xml += `        <addr1>${escapeXml(prop.googleHotelData.address.street)}</addr1>\n`;
            xml += `        <city>${escapeXml(prop.googleHotelData.address.city)}</city>\n`;
            xml += `        <country>${escapeXml(prop.googleHotelData.address.countryCode)}</country>\n`;
            xml += `      </Address>\n`;
        }
        if (prop.linkFotos) {
            xml += `      <Photo URL="${escapeXml(prop.linkFotos)}"/>\n`;
        }
        xml += `    </Property>\n`;
    });

    xml += `  </Result>\n`;
    xml += `</Transaction>`;

    return xml;
};

// --- NUEVA FUNCIÓN PARA EL FEED ARI ---
const generateAriFeed = async (_db, empresaId, options = {}) => {
    const mode = String(options.mode || 'website').toLowerCase() === 'google_hotels' ? 'google_hotels' : 'website';
    const daysRaw = Math.round(Number(options.days));
    const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(14, daysRaw)) : 180;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Google recomienda 180-365; dejamos parámetro acotado para UI/operación.
    const endDateLimit = new Date(today);
    endDateLimit.setDate(today.getDate() + days);

    const [propiedades, canalRes] = await Promise.all([
        obtenerPropiedadesPorEmpresa(null, empresaId),
        pool.query(
            `SELECT id, metadata->>'moneda' AS moneda FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
            [empresaId]
        ),
    ]);

    if (!canalRes.rows[0]) {
        throw new Error('No se ha configurado un canal por defecto.');
    }
    const canalPorDefectoId = canalRes.rows[0].id;
    const canalPorDefectoMoneda = canalRes.rows[0].moneda || 'CLP';

    const propiedadesListadas = propiedades.filter(p => p.googleHotelData && p.googleHotelData.isListed && p.googleHotelData.hotelId);
    if (propiedadesListadas.length === 0) {
        return `<?xml version="1.0" encoding="UTF-8"?><Transaction timestamp="${new Date().toISOString()}" id="ari-update"><Result/></Transaction>`; // Feed vacío si no hay propiedades listadas
    }

    // Obtener disponibilidad general para el rango completo
    const { availabilityMap, allTarifas } = await getAvailabilityData(_db, empresaId, today, endDateLimit);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<Transaction timestamp="${new Date().toISOString()}" id="ari-update-${mode}-${days}d">\n`;

    for (const prop of propiedadesListadas) {
        xml += `  <Result>\n`;
        xml += `    <Property id="${escapeXml(prop.googleHotelData.hotelId)}">\n`;
        // Usaremos Room ID = Property ID y Rate Plan ID = 'standard' por simplicidad inicial
        xml += `      <RoomData RoomID="${escapeXml(prop.googleHotelData.hotelId)}">\n`;
        
        let currentAvailabilitySegment = null;
        let currentRateSegment = null;

        for (let d = new Date(today); d < endDateLimit; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Verificar si hay alguna reserva que ocupe este día
            const isOccupied = (availabilityMap.get(prop.id) || []).some(res =>
                currentDate >= res.start && currentDate < res.end
            );

            const inventory = isOccupied ? 0 : 1; // Asumimos 1 unidad por propiedad por ahora

            // Calcular Precio
            let rateForDay = 0;
            const tarifasDelDia = allTarifas.filter(t => 
                t.alojamientoId === prop.id &&
                t.fechaInicio <= currentDate &&
                t.fechaTermino >= currentDate
            );
            if (!isOccupied && tarifasDelDia.length > 0) {
                const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0]; // Tomar la más específica
                rateForDay = (tarifa.precios && tarifa.precios[canalPorDefectoId]) ? tarifa.precios[canalPorDefectoId] : 0;
            }

            // Agrupar segmentos de disponibilidad (inventario)
            if (currentAvailabilitySegment && currentAvailabilitySegment.inventory === inventory) {
                currentAvailabilitySegment.endDate = dateStr;
            } else {
                if (currentAvailabilitySegment) {
                    xml += `        <Inventory UpdateType="Overlay" CheckIn="${currentAvailabilitySegment.startDate}" CheckOut="${new Date(new Date(currentAvailabilitySegment.endDate).setDate(new Date(currentAvailabilitySegment.endDate).getDate() + 1)).toISOString().split('T')[0]}">${currentAvailabilitySegment.inventory}</Inventory>\n`;
                }
                currentAvailabilitySegment = { startDate: dateStr, endDate: dateStr, inventory: inventory };
            }

            // Agrupar segmentos de tarifas (solo si está disponible)
            if (inventory > 0) {
                 if (currentRateSegment && currentRateSegment.rate === rateForDay) {
                     currentRateSegment.endDate = dateStr;
                 } else {
                     if (currentRateSegment) {
                          xml += `        <Rate RatePlanID="standard" UpdateType="Overlay" CheckIn="${currentRateSegment.startDate}" CheckOut="${new Date(new Date(currentRateSegment.endDate).setDate(new Date(currentRateSegment.endDate).getDate() + 1)).toISOString().split('T')[0]}">\n`;
                          xml += `          <Baserate currency="${canalPorDefectoMoneda}">${currentRateSegment.rate}</Baserate>\n`;
                          xml += `        </Rate>\n`;
                     }
                     currentRateSegment = rateForDay > 0 ? { startDate: dateStr, endDate: dateStr, rate: rateForDay } : null;
                 }
            } else { // Si no está disponible, cerrar cualquier segmento de tarifa abierto
                 if (currentRateSegment) {
                     xml += `        <Rate RatePlanID="standard" UpdateType="Overlay" CheckIn="${currentRateSegment.startDate}" CheckOut="${new Date(new Date(currentRateSegment.endDate).setDate(new Date(currentRateSegment.endDate).getDate() + 1)).toISOString().split('T')[0]}">\n`;
                     xml += `          <Baserate currency="${canalPorDefectoMoneda}">${currentRateSegment.rate}</Baserate>\n`;
                     xml += `        </Rate>\n`;
                     currentRateSegment = null;
                 }
            }
        }
        
        // Cerrar los últimos segmentos abiertos
        if (currentAvailabilitySegment) {
             xml += `        <Inventory UpdateType="Overlay" CheckIn="${currentAvailabilitySegment.startDate}" CheckOut="${new Date(new Date(currentAvailabilitySegment.endDate).setDate(new Date(currentAvailabilitySegment.endDate).getDate() + 1)).toISOString().split('T')[0]}">${currentAvailabilitySegment.inventory}</Inventory>\n`;
        }
        if (currentRateSegment) {
             xml += `        <Rate RatePlanID="standard" UpdateType="Overlay" CheckIn="${currentRateSegment.startDate}" CheckOut="${new Date(new Date(currentRateSegment.endDate).setDate(new Date(currentRateSegment.endDate).getDate() + 1)).toISOString().split('T')[0]}">\n`;
             xml += `          <Baserate currency="${canalPorDefectoMoneda}">${currentRateSegment.rate}</Baserate>\n`;
             xml += `        </Rate>\n`;
        }

        xml += `      </RoomData>\n`;
        xml += `    </Property>\n`;
        xml += `  </Result>\n`;
    }

    xml += `</Transaction>`;
    return xml;
};


module.exports = {
    generatePropertyListFeed,
    generateAriFeed // Exportar la nueva función
};