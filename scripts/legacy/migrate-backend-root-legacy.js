#!/usr/bin/env node
/**
 * Migra scripts y artefactos sueltos en backend/ (una vez).
 * Ejecutar desde la raíz del repo: node scripts/legacy/migrate-backend-root-legacy.js
 */
const fs = require('fs');
const path = require('path');

const BACK = path.join(__dirname, '..', '..', 'backend');
const LEGACY = path.join(BACK, 'scripts', 'legacy-root');
const FIXTURES = path.join(LEGACY, 'fixtures');
const LOCALB = path.join(__dirname, '..', '..', 'local', 'backend');
const DOCS = path.join(BACK, 'docs');

const KEEP_JS = new Set(['index.js', 'types.js', 'tailwind.config.js']);

function transformJs(code, fileName) {
    let c = code;

    c = c.replace(/require\((['"])\.\/services\//g, 'require($1../../services/');
    c = c.replace(/require\((['"])\.\/db\//g, 'require($1../../db/');
    c = c.replace(/require\((['"])\.\/middleware\//g, 'require($1../../middleware/');
    c = c.replace(/require\((['"])\.\/routes\//g, 'require($1../../routes/');
    c = c.replace(/require\((['"])\.\/api\//g, 'require($1../../api/');
    c = c.replace(/require\(\s*(['"])\.\/serviceAccountKey\.json\1\)/g, "require('../../serviceAccountKey.json')");
    c = c.replace(/require\(\s*(['"])\.\/google_credentials\.json\1\)/g, "require('../../google_credentials.json')");

    c = c.replace(/path\.join\(__dirname,\s*['"]services['"],/g, "path.join(__dirname, '../../services',");
    c = c.replace(/path\.join\(__dirname,\s*['"]routes['"],/g, "path.join(__dirname, '../../routes',");
    c = c.replace(/path\.join\(__dirname,\s*['"]views['"],/g, "path.join(__dirname, '../../views',");

    c = c.replace(
        /require\(['"]dotenv['"]\)\.config\(\{\s*path:\s*['"]\.env['"]\s*\}\)/g,
        "require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })"
    );

    if (fileName === 'verify_firestore_structure.js') {
        c = c.replace(
            /const localDir = path\.join\(__dirname, '\.\.', 'local'\)/,
            "const localDir = path.join(__dirname, '..', '..', '..', 'local')"
        );
    }

    if (fileName === 'extract_images.js') {
        if (!/^const path = require/m.test(c)) {
            c = "const path = require('path');\n" + c;
        }
        c = c.replace(
            /fs\.readFileSync\(['"]property_detail_seeded\.json['"],\s*['"]utf8['"]\)/,
            "fs.readFileSync(path.join(__dirname, 'fixtures', 'property_detail_seeded.json'), 'utf8')"
        );
    }

    if (fileName === 'test-eliminacion-fotos.js') {
        c = c.replace(/path\.join\(__dirname,\s*['"]\.env['"]\)/g, "path.join(__dirname, '..', '..', '.env')");
        c = c.replace(
            /path\.join\(__dirname,\s*'\.\.',\s*archivo\)/g,
            "path.join(__dirname, '..', '..', '..', archivo)"
        );
        c = c.replace(/path\.join\(__dirname,\s*'services',/g, "path.join(__dirname, '../../services',");
        c = c.replace(/path\.join\(__dirname,\s*'routes',/g, "path.join(__dirname, '../../routes',");
        c = c.replace(
            /path\.join\(__dirname,\s*'\.\.',\s*'frontend'/g,
            "path.join(__dirname, '..', '..', '..', 'frontend'"
        );
    }

    c = c.replace(
        /fs\.writeFileSync\(['"]debug_output\.json['"],/g,
        "fs.writeFileSync(require('path').join(__dirname, '../../../local/backend/debug_output.json'),"
    );
    c = c.replace(
        /fs\.writeFileSync\(['"]debug_data\.json['"],/g,
        "fs.writeFileSync(require('path').join(__dirname, '../../../local/backend/debug_data.json'),"
    );
    c = c.replace(
        /fs\.writeFileSync\(['"]debug_result\.json['"],/g,
        "fs.writeFileSync(require('path').join(__dirname, '../../../local/backend/debug_result.json'),"
    );

    return c;
}

function main() {
    fs.mkdirSync(LEGACY, { recursive: true });
    fs.mkdirSync(FIXTURES, { recursive: true });
    fs.mkdirSync(LOCALB, { recursive: true });
    fs.mkdirSync(DOCS, { recursive: true });

    const skipArtifact = new Set(['package.json', 'package-lock.json']);
    const jsonArtifacts = new Set([
        'models_list.json',
        'payload.json',
        'response.json',
        'validation_result.json',
        'debug_output.json',
        'debug_public_props.json',
        'debug_result.json',
        'property_detail.json',
        'property_detail_valid.json',
        'property_detail_seeded.json'
    ]);

    const names = fs.readdirSync(BACK);
    for (const name of names) {
        const full = path.join(BACK, name);
        if (!fs.statSync(full).isFile()) continue;

        if (name === 'design_booking_intent.md') {
            fs.renameSync(full, path.join(DOCS, name));
            console.log(`moved ${name} -> backend/docs/`);
            continue;
        }

        const ext = path.extname(name).toLowerCase();

        if (name.endsWith('.log') || name.endsWith('_output.txt') || name.endsWith('_provider.txt')) {
            fs.renameSync(full, path.join(LOCALB, name));
            console.log(`artifact ${name} -> local/backend/`);
            continue;
        }

        if (
            [
                'categories_output.txt',
                'validation_output.txt',
                'asset_schema_dump.txt',
                'debug_output.txt',
                'debug_raw_ai_fail.txt',
                'debug_error_provider.txt',
                'ai_raw_log.txt'
            ].includes(name)
        ) {
            fs.renameSync(full, path.join(LOCALB, name));
            console.log(`artifact ${name} -> local/backend/`);
            continue;
        }

        if (ext === '.json' && jsonArtifacts.has(name) && !skipArtifact.has(name)) {
            const dest = path.join(LOCALB, name);
            fs.renameSync(full, dest);
            console.log(`artifact ${name} -> local/backend/`);
            continue;
        }

        if (ext !== '.js') continue;
        if (KEEP_JS.has(name)) continue;

        const raw = fs.readFileSync(full, 'utf8');
        const out = transformJs(raw, name);
        fs.writeFileSync(path.join(LEGACY, name), out, 'utf8');
        fs.unlinkSync(full);
        console.log(`script ${name} -> backend/scripts/legacy-root/`);
    }

    const seededFixture = path.join(FIXTURES, 'property_detail_seeded.json');
    const seededLocal = path.join(LOCALB, 'property_detail_seeded.json');
    if (fs.existsSync(seededLocal) && !fs.existsSync(seededFixture)) {
        fs.renameSync(seededLocal, seededFixture);
        console.log('fixture property_detail_seeded.json -> legacy-root/fixtures/');
    }

    console.log('Done.');
}

main();
