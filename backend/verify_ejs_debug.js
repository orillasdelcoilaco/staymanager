const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const viewPath = path.join(__dirname, 'views', 'propiedad_debug.ejs');

try {
    const template = fs.readFileSync(viewPath, 'utf-8');
    ejs.compile(template, { filename: viewPath });
    console.log('✅ Sintaxis EJS correcta (DEBUG).');
} catch (error) {
    console.error('❌ Error de sintaxis EJS (DEBUG):', error.message);
}
