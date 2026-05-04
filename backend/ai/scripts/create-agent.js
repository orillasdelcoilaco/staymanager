const fs = require('fs');
const path = require('path');

// Parseo simple de argumentos tipo --empresaId=xxx --nombre="nombre"
const args = process.argv.slice(2);
let empresaId = null;
let nombreEmpresa = null;

args.forEach(arg => {
    if (arg.startsWith('--empresaId=')) {
        empresaId = arg.replace('--empresaId=', '').trim();
    }
    if (arg.startsWith('--nombre=')) {
        nombreEmpresa = arg.replace('--nombre=', '').trim().replace(/"/g, '');
    }
});

if (!empresaId || !nombreEmpresa) {
    console.error('\n❌ Error: Debes entregar --empresaId y --nombre\n');
    console.error('Ejemplo:');
    console.error('  npm run create-agent --empresaId=orillasdelcoilaco --nombre="Orillas del Coilaco"\n');
    process.exit(1);
}

// Rutas
const templatePath = path.join(__dirname, '..', 'plantillas', 'agent-empresa-template.md');
const outputDir = path.join(__dirname, '..', 'agentes', 'empresa');
const outputFile = path.join(outputDir, `${empresaId}.md`);

// Verifica carpeta destino
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Cargar plantilla
let template = fs.readFileSync(templatePath, 'utf8');

// Reemplazos
template = template.replace(/{{EMPRESA_ID}}/g, empresaId);
template = template.replace(/{{NOMBRE_EMPRESA}}/g, nombreEmpresa);

// Guardar archivo
fs.writeFileSync(outputFile, template, 'utf8');

console.log(`\n✅ Agente generado correctamente: ${outputFile}\n`);
