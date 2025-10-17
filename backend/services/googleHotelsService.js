// backend/services/googleHotelsService.js
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');

// Función para escapar caracteres XML
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

const generatePropertyListFeed = async (db, empresaId) => {
    const propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
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

module.exports = {
    generatePropertyListFeed
};