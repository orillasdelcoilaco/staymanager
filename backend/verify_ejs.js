const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const viewPath = path.join(__dirname, 'views', 'propiedad.ejs');

try {
    const template = fs.readFileSync(viewPath, 'utf-8');
    // Intentar compilar el template. No necesitamos datos reales para verificar sintaxis básica.
    ejs.compile(template, { filename: viewPath });
    console.log('✅ Sintaxis EJS correcta.');
} catch (error) {
    console.error('❌ Error de sintaxis EJS:', error.message);
}
