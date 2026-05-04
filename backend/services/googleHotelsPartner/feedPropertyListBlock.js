/**
 * Fragmento XML de una propiedad en Property List (convención cercana a documentación Google / asesores).
 * Mantiene un solo lugar para Name, Address, category, Phone, PhotoURL, DeepLink.
 */
const escapeXml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

const escapeXmlAttr = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
};

/**
 * @param {object} params
 * @param {string} params.xmlPropertyId - atributo id de Property
 * @param {string} params.nombre
 * @param {object} params.addr - street, city, province, postalCode, countryCode
 * @param {string} params.category
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {string} [params.phone]
 * @param {string} [params.website]
 * @param {string|null} [params.fotoUrl]
 * @param {string} [params.deepLink]
 * @param {string} [params.formatDecimalCoord]
 */
function buildPropertyListItemXml({
    xmlPropertyId,
    nombre,
    addr,
    category,
    lat,
    lng,
    phone,
    website,
    fotoUrl,
    deepLink,
    formatDecimalCoord = (n) => (n == null || !Number.isFinite(Number(n)) ? '0' : String(Number(n))),
}) {
    const a = addr && typeof addr === 'object' ? addr : {};
    let body = `    <Property id="${escapeXml(String(xmlPropertyId))}">\n`;
    body += `      <Name>${escapeXml(String(nombre || ''))}</Name>\n`;
    body += `      <Address>\n`;
    body += `        <AddressLine>${escapeXml(String(a.street || ''))}</AddressLine>\n`;
    body += `        <City>${escapeXml(String(a.city || a.locality || ''))}</City>\n`;
    if (a.province) {
        body += `        <StateProv>${escapeXml(String(a.province))}</StateProv>\n`;
    }
    if (a.postalCode || a.postal_code) {
        body += `        <PostalCode>${escapeXml(String(a.postalCode || a.postal_code || ''))}</PostalCode>\n`;
    }
    body += `        <Country>${escapeXml(String(a.countryCode || a.country || ''))}</Country>\n`;
    body += `      </Address>\n`;
    if (phone) {
        body += `      <Phone number="${escapeXmlAttr(String(phone).trim())}"/>\n`;
    }
    body += `      <category>${escapeXml(String(category || 'vacation_rental'))}</category>\n`;
    if (website) {
        body += `      <Website>${escapeXml(String(website))}</Website>\n`;
    }
    body += `      <Latitude>${formatDecimalCoord(lat)}</Latitude>\n`;
    body += `      <Longitude>${formatDecimalCoord(lng)}</Longitude>\n`;
    if (fotoUrl) {
        body += `      <PhotoURL>${escapeXml(String(fotoUrl).trim())}</PhotoURL>\n`;
    }
    if (deepLink) {
        body += `      <DeepLink>${escapeXml(String(deepLink))}</DeepLink>\n`;
    }
    body += `    </Property>\n`;
    return body;
}

module.exports = {
    buildPropertyListItemXml,
    escapeXml,
    escapeXmlAttr,
};
