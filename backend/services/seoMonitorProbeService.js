/**
 * Sondeo ligero de robots.txt y sitemap.xml desde el backend (timeout + muestra parcial del cuerpo).
 * No sustituye Search Console; valida que el host responde en producción.
 */

const MAX_SAMPLE_BYTES = 4096;
const DEFAULT_TIMEOUT_MS = 12000;

function getFetch() {
    if (typeof fetch === 'function') return fetch;
    return require('node-fetch');
}

function sampleNodeStream(stream, maxBytes) {
    return new Promise((resolve, reject) => {
        let total = 0;
        let settled = false;
        const finish = (fn, val) => {
            if (settled) return;
            settled = true;
            stream.removeListener('data', onData);
            fn(val);
        };
        const onData = (chunk) => {
            total += chunk.length;
            if (total >= maxBytes) {
                stream.destroy();
                finish(resolve, total);
            }
        };
        stream.on('data', onData);
        stream.once('end', () => finish(resolve, total));
        stream.once('error', (err) => {
            if (settled) return;
            settled = true;
            stream.removeListener('data', onData);
            reject(err);
        });
    });
}

async function sampleResponseBody(res, maxBytes) {
    if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        let total = 0;
        try {
            while (total < maxBytes) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
            }
        } finally {
            await reader.cancel().catch(() => {});
        }
        return total;
    }
    if (res.body && typeof res.body.on === 'function') {
        return sampleNodeStream(res.body, maxBytes);
    }
    const buf = await res.arrayBuffer();
    return Math.min(buf.byteLength, maxBytes);
}

async function probeUrl(url, { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_SAMPLE_BYTES } = {}) {
    const fetchImpl = getFetch();
    const started = Date.now();
    const out = {
        url,
        ok: false,
        status: null,
        durationMs: null,
        error: null,
        contentType: null,
        sampledBytes: 0,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetchImpl(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': 'SuiteManager-SEO-Monitor/1.0' },
        });
        out.status = res.status;
        const ct = res.headers.get('content-type') || '';
        out.contentType = ct.split(';')[0].trim();
        if (!res.ok) {
            out.ok = false;
            out.durationMs = Date.now() - started;
            return out;
        }
        out.sampledBytes = await sampleResponseBody(res, maxBytes);
        out.ok = true;
    } catch (e) {
        out.error = e.name === 'AbortError' ? 'timeout' : (e.message || String(e));
        out.ok = false;
    } finally {
        clearTimeout(timer);
        out.durationMs = Date.now() - started;
    }
    return out;
}

async function probeRobotsAndSitemap(baseUrl) {
    if (!baseUrl || typeof baseUrl !== 'string') {
        return { skipped: true, reason: 'Sin URL base' };
    }
    const clean = baseUrl.replace(/\/$/, '');
    const [robots, sitemap] = await Promise.all([
        probeUrl(`${clean}/robots.txt`),
        probeUrl(`${clean}/sitemap.xml`),
    ]);
    return { skipped: false, robots, sitemap };
}

module.exports = { probeRobotsAndSitemap, probeUrl };
