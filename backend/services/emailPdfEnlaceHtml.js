/**
 * Bloque HTML opcional con enlace al manual PDF cuando no se adjunta el archivo.
 * @param {string} url
 * @param {'es'|'en'} hl
 */
function htmlBloqueEnlacePdfManual(url, hl = 'es') {
    const u = String(url || '').trim();
    if (!u) return '';
    const en = hl === 'en';
    const esc = (s) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const title = en ? 'Guest guide (PDF)' : 'Manual del huésped (PDF)';
    const lead = en
        ? 'We could not attach the PDF to this email. Open or download it from this link:'
        : 'No pudimos adjuntar el PDF a este correo. Ábrelo o descárgalo desde este enlace:';
    return `<div style="margin-top:18px;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;font-family:Arial,sans-serif;font-size:14px;color:#1f2937">
<p style="margin:0 0 8px;font-weight:600">${esc(title)}</p>
<p style="margin:0 0 10px;line-height:1.45">${esc(lead)}</p>
<p style="margin:0;word-break:break-all"><a href="${esc(u)}" style="color:#2563eb;font-weight:500">${esc(u)}</a></p>
</div>`;
}

module.exports = { htmlBloqueEnlacePdfManual };
