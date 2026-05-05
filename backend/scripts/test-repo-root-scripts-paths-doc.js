/**
 * Contrato: la documentación cita solo rutas reales bajo `scripts/tooling/*.js` y `scripts/legacy/*.js`
 * (evita rutas rotas tras mover herramientas o one-off).
 *
 * Ejecutar desde la raíz del repo: node backend/scripts/test-repo-root-scripts-paths-doc.js
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const SKIP_DIR_NAMES = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    'local',
]);

const SKIP_FILE_NAMES = new Set(['package-lock.json']);

/** Evita falsos positivos al citar otros árboles `.../scripts/foo.js`. */
function maskOtherScriptTrees(text) {
    return text
        .replace(/backend\/scripts\/[a-zA-Z0-9_.-]+\.js/g, '__OTHER_SCRIPTS__')
        .replace(/ai\/scripts\/[a-zA-Z0-9_.-]+\.js/g, '__OTHER_SCRIPTS__');
}

const RE_TOOLING_SCRIPT = /\bscripts\/tooling\/([a-zA-Z0-9_.-]+\.js)\b/g;
const RE_LEGACY_SCRIPT = /\bscripts\/legacy\/([a-zA-Z0-9_.-]+\.js)\b/g;
/** `scripts/foo.js` sin tooling/ ni legacy/ — obsoleto tras reorganización. */
const RE_STALE_SCRIPTS_JS = /\bscripts\/(?!tooling\/|legacy\/)([a-zA-Z0-9_.-]+\.js)\b/g;

function collectFiles(dir, acc) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (SKIP_DIR_NAMES.has(ent.name)) continue;
            collectFiles(full, acc);
            continue;
        }
        if (SKIP_FILE_NAMES.has(ent.name)) continue;
        const low = ent.name.toLowerCase();
        if (low.endsWith('.md') || low.endsWith('.mdc')) acc.push(full);
    }
}

function lineOfIndex(content, idx) {
    return content.slice(0, idx).split('\n').length;
}

function checkMatches(content, fileRelPosix, errors, repoRoot) {
    const masked = maskOtherScriptTrees(content);

    function verifyExists(re, segmentsFromRepo, label) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(masked)) !== null) {
            const name = m[1];
            const abs = path.join(repoRoot, ...segmentsFromRepo, name);
            if (!fs.existsSync(abs)) {
                const line = lineOfIndex(masked, m.index);
                const posixPath = path.posix.join(...segmentsFromRepo.map((s) => s.replace(/\\/g, '/')), name);
                errors.push(`${fileRelPosix}:${line}: no existe ${posixPath}`);
            }
        }
    }

    verifyExists(RE_TOOLING_SCRIPT, ['scripts', 'tooling'], 'tooling');
    verifyExists(RE_LEGACY_SCRIPT, ['scripts', 'legacy'], 'legacy');

    RE_STALE_SCRIPTS_JS.lastIndex = 0;
    let sm;
    while ((sm = RE_STALE_SCRIPTS_JS.exec(masked)) !== null) {
        const line = lineOfIndex(masked, sm.index);
        errors.push(
            `${fileRelPosix}:${line}: referencia obsoleta scripts/${sm[1]} — usar scripts/tooling/ o scripts/legacy/`
        );
    }
}

function main() {
    const files = [];
    collectFiles(REPO_ROOT, files);

    const errors = [];
    for (const abs of files) {
        const rel = path.relative(REPO_ROOT, abs);
        const relPosix = rel.split(path.sep).join('/');
        let raw;
        try {
            raw = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        checkMatches(raw, relPosix, errors, REPO_ROOT);
    }

    if (errors.length) {
        console.error('test-repo-root-scripts-paths-doc: rutas scripts/ citadas en docs pero archivo ausente u obsoleto:\n');
        for (const e of errors) console.error(`  ${e}`);
        process.exit(1);
    }
    console.log('test-repo-root-scripts-paths-doc: OK');
}

main();
