// backend/services/renderDomainService.js
//
// Cliente para la Render API — gestión de dominios personalizados.
// Requiere variables de entorno:
//   RENDER_API_KEY    — API key generada en dashboard.render.com → Account Settings → API Keys
//   RENDER_SERVICE_ID — ID del servicio (visible en la URL del servicio en Render, ej: srv-xxxxx)

const RENDER_API_BASE = 'https://api.render.com/v1';

function _headers() {
    const key = process.env.RENDER_API_KEY;
    if (!key) throw new Error('RENDER_API_KEY no está configurada en las variables de entorno');
    return {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

function _serviceId() {
    const id = process.env.RENDER_SERVICE_ID;
    if (!id) throw new Error('RENDER_SERVICE_ID no está configurada en las variables de entorno');
    return id;
}

/**
 * Agrega un dominio personalizado al servicio en Render.
 * @param {string} domainName — ej: "www.orillasdelcoilaco.cl"
 * @returns {{ id, name, domainType, verificationStatus, cnameTarget }}
 */
async function addCustomDomain(domainName) {
    if (!domainName || typeof domainName !== 'string') {
        throw new Error('domainName es requerido');
    }

    const serviceId = _serviceId();
    const url = `${RENDER_API_BASE}/services/${serviceId}/custom-domains`;

    const response = await fetch(url, {
        method: 'POST',
        headers: _headers(),
        body: JSON.stringify({ name: domainName.trim().toLowerCase() })
    });

    if (response.status === 409) {
        // El dominio ya está registrado — no es un error fatal
        console.log(`[RenderDomain] Dominio ${domainName} ya existe en Render`);
        const existing = await getCustomDomain(domainName);
        return { ...existing, alreadyExisted: true };
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Render API error ${response.status}: ${body.message || JSON.stringify(body)}`);
    }

    const data = await response.json();
    console.log(`[RenderDomain] Dominio ${domainName} registrado exitosamente`);
    return _mapDomain(data);
}

/**
 * Elimina un dominio personalizado del servicio en Render.
 * @param {string} domainIdOrName — ID o nombre del dominio
 */
async function removeCustomDomain(domainIdOrName) {
    if (!domainIdOrName) throw new Error('domainIdOrName es requerido');

    const serviceId = _serviceId();
    const encoded = encodeURIComponent(domainIdOrName.trim().toLowerCase());
    const url = `${RENDER_API_BASE}/services/${serviceId}/custom-domains/${encoded}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: _headers()
    });

    if (response.status === 404) {
        console.warn(`[RenderDomain] Dominio ${domainIdOrName} no existe en Render (404), ignorando`);
        return { ok: true, notFound: true };
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Render API error ${response.status}: ${body.message || JSON.stringify(body)}`);
    }

    console.log(`[RenderDomain] Dominio ${domainIdOrName} eliminado de Render`);
    return { ok: true };
}

/**
 * Lista todos los dominios personalizados registrados en el servicio.
 * @returns {Array<{ id, name, domainType, verificationStatus }>}
 */
async function listCustomDomains() {
    const serviceId = _serviceId();
    const url = `${RENDER_API_BASE}/services/${serviceId}/custom-domains?limit=100`;

    const response = await fetch(url, {
        method: 'GET',
        headers: _headers()
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Render API error ${response.status}: ${body.message || JSON.stringify(body)}`);
    }

    const data = await response.json();
    // La API devuelve array de { cursor, customDomain } o directamente array
    const items = Array.isArray(data) ? data : (data.customDomains || data.data || []);
    return items.map(item => _mapDomain(item.customDomain || item));
}

/**
 * Obtiene un dominio específico por nombre.
 * @param {string} domainName
 * @returns {{ id, name, domainType, verificationStatus } | null}
 */
async function getCustomDomain(domainName) {
    const serviceId = _serviceId();
    const encoded = encodeURIComponent(domainName.trim().toLowerCase());
    const url = `${RENDER_API_BASE}/services/${serviceId}/custom-domains/${encoded}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: _headers()
    });

    if (response.status === 404) return null;

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Render API error ${response.status}: ${body.message || JSON.stringify(body)}`);
    }

    const data = await response.json();
    return _mapDomain(data);
}

/**
 * Registra o actualiza un dominio: si el dominio anterior era distinto, elimina el viejo y agrega el nuevo.
 * Retorna las instrucciones DNS que el cliente debe aplicar.
 * @param {string} newDomain — nuevo dominio a registrar
 * @param {string|null} oldDomain — dominio anterior (para limpiar si cambió)
 * @returns {{ domain, cnameTarget, instructions, alreadyExisted }}
 */
async function syncDomain(newDomain, oldDomain = null) {
    const serviceId = _serviceId();

    // Limpiar dominio anterior si cambió
    if (oldDomain && oldDomain !== newDomain) {
        await removeCustomDomain(oldDomain).catch(err =>
            console.warn(`[RenderDomain] No se pudo eliminar dominio anterior ${oldDomain}: ${err.message}`)
        );
    }

    const result = await addCustomDomain(newDomain);

    // El target CNAME donde el cliente debe apuntar su DNS es el hostname del servicio en Render
    // Render lo devuelve implícitamente — el target es siempre el hostname del servicio
    const cnameTarget = `${serviceId}.onrender.com`;

    const isApex = !newDomain.startsWith('www.') && newDomain.split('.').length === 2;
    const instructions = _buildDnsInstructions(newDomain, cnameTarget, isApex);

    return {
        domain: newDomain,
        cnameTarget,
        instructions,
        alreadyExisted: result.alreadyExisted || false,
        verificationStatus: result.verificationStatus || 'unverified'
    };
}

// --- Helpers privados ---

function _mapDomain(data) {
    if (!data) return null;
    return {
        id: data.id || '',
        name: data.name || '',
        domainType: data.domainType || 'subdomain',
        verificationStatus: data.verificationStatus || 'unverified',
        createdAt: data.createdAt || null
    };
}

function _buildDnsInstructions(domain, cnameTarget, isApex) {
    if (isApex) {
        // Dominio raíz (sin www) — usar A record o ALIAS
        return {
            type: 'A / ALIAS',
            host: '@',
            value: cnameTarget,
            note: `Para dominios raíz (sin www) algunos registradores requieren registro ALIAS o ANAME. Si tu registrador no soporta ALIAS, usa www.${domain} con CNAME en su lugar.`
        };
    }
    // Subdominio (www.xxx.cl o sub.xxx.cl)
    const host = domain.split('.')[0]; // "www" o el subdominio
    return {
        type: 'CNAME',
        host,
        value: cnameTarget,
        note: `Agrega este registro CNAME en el panel DNS de tu dominio (ej: NicChile, Cloudflare, GoDaddy). Los cambios DNS pueden tardar hasta 24 horas en propagarse.`
    };
}

module.exports = {
    addCustomDomain,
    removeCustomDomain,
    listCustomDomains,
    getCustomDomain,
    syncDomain
};
