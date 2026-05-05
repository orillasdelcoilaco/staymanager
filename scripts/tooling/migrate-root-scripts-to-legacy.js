#!/usr/bin/env node
/**
 * Mueve scripts one-off de scripts/ → scripts/legacy/ y ajusta rutas (__dirname + ../backend, etc.).
 * Herramientas activas viven en `scripts/tooling/`.
 * Ejecutar desde la raíz: node scripts/tooling/migrate-root-scripts-to-legacy.js
 */
const fs = require('fs');
const path = require('path');

const SCRIPTS = path.join(__dirname, '..');
const LEGACY = path.join(__dirname, '..', 'legacy');

/** Archivos en la raíz `scripts/` que no deben moverse a legacy. */
const KEEP = new Set(['README.md']);

function transform(content, fileName) {
    let c = content;

    c = c.replace(/path\.join\(__dirname,\s*'\.\.',\s*'TASKS'/g, "path.join(__dirname, '..', '..', 'TASKS'");
    c = c.replace(/path\.join\(__dirname,\s*'\.\.',\s*'frontend'/g, "path.join(__dirname, '..', '..', 'frontend'");
    c = c.replace(/path\.join\(__dirname,\s*'\.\.',\s*'backend'/g, "path.join(__dirname, '..', '..', 'backend'");
    c = c.replace(/path\.join\(__dirname,\s*'\.\.',\s*'local'/g, "path.join(__dirname, '..', '..', 'local'");

    c = c.replace(/path\.join\(__dirname,\s*'\.\.\/backend\//g, "path.join(__dirname, '../../backend/");
    c = c.replace(/path\.join\(__dirname,\s*"\.\.\/backend\//g, 'path.join(__dirname, "../../backend/');

    c = c.replace(/\.\.\/backend\//g, '../../backend/');

    c = c.replace(
        /const repoRoot = path\.join\(__dirname,\s*'\.\.'\)/g,
        "const repoRoot = path.join(__dirname, '..', '..')"
    );

    c = c.replace(/path\.join\(__dirname,\s*'backups'\)/g, "path.join(__dirname, '..', '..', 'backups')");

    if (fileName === 'migrate-backend-root-legacy.js') {
        c = c.replace(
            /const BACK = path\.join\(__dirname,\s*'\.\.',\s*'backend'\)/,
            "const BACK = path.join(__dirname, '..', '..', 'backend')"
        );
    }

    return c;
}

function main() {
    fs.mkdirSync(LEGACY, { recursive: true });

    const entries = fs.readdirSync(SCRIPTS, { withFileTypes: true });
    for (const e of entries) {
        if (!e.isFile()) continue;
        const name = e.name;
        if (KEEP.has(name)) continue;

        const src = path.join(SCRIPTS, name);
        const dest = path.join(LEGACY, name);
        const raw = fs.readFileSync(src, 'utf8');
        fs.writeFileSync(dest, transform(raw, name), 'utf8');
        fs.unlinkSync(src);
        console.log(`moved ${name} -> scripts/legacy/`);
    }

    console.log('Done.');
}

main();
