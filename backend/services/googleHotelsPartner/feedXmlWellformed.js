const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { XMLParser } = require('fast-xml-parser');

let warnedXmllintMissing;

/**
 * Valida que el string sea XML bien formado (§7.10 — primera línea de defensa).
 */
function assertXmlWellformed(xml) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseTagValue: false,
        trimValues: false,
    });
    parser.parse(xml);
}

/**
 * Si `GOOGLE_HOTELS_XSD_PATH` apunta a un XSD en disco y `xmllint` está en PATH,
 * valida contra el esquema (§7.10 — obligatorio cuando el archivo existe).
 * Sin env / xmllint / archivo: solo well-formed; sin “fail open” silencioso si xmllint falla estando configurado.
 */
function assertOptionalXsd(xml, label = 'feed') {
    const raw = String(process.env.GOOGLE_HOTELS_XSD_PATH || '').trim();
    if (!raw) return;

    const resolved = path.resolve(raw);
    if (!fs.existsSync(resolved)) {
        console.warn(`[feedXml] GOOGLE_HOTELS_XSD_PATH no existe: ${resolved} (${label})`);
        return;
    }

    const result = spawnSync('xmllint', ['--noout', '--schema', resolved, '-'], {
        input: xml,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
    });

    if (result.error && result.error.code === 'ENOENT') {
        if (!warnedXmllintMissing) {
            warnedXmllintMissing = true;
            console.warn('[feedXml] xmllint no está en PATH; omitiendo validación XSD');
        }
        return;
    }

    if (result.status !== 0) {
        const msg = (result.stderr || result.stdout || '').trim() || 'xmllint falló';
        throw new Error(`XSD (${label}): ${msg}`);
    }
}

function assertPartnerFeedXml(xml, label) {
    assertXmlWellformed(xml);
    assertOptionalXsd(xml, label);
}

module.exports = {
    assertXmlWellformed,
    assertOptionalXsd,
    assertPartnerFeedXml,
};
