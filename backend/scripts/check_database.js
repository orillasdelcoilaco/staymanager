// Verificar datos reales en base de datos
const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Buscar empresa 'Orillas del Coilaco'
        const { rows } = await pool.query(
            "SELECT id, nombre, subdominio, dominio, configuracion FROM empresas WHERE nombre LIKE $1",
            ['%Orillas del Coilaco%']
        );

        console.log('=== DATOS REALES EN BASE DE DATOS ===');
        rows.forEach((empresa, i) => {
            console.log(`\n📊 Empresa ${i + 1}: ${empresa.nombre} (ID: ${empresa.id})`);
            console.log(`- Subdominio (columna): ${empresa.subdominio || 'NULL'}`);
            console.log(`- Dominio (columna): ${empresa.dominio || 'NULL'}`);

            if (empresa.configuracion && empresa.configuracion.websiteSettings) {
                const ws = empresa.configuracion.websiteSettings;
                console.log('- websiteSettings encontrado:');
                console.log(`  • subdomain: ${ws.subdomain || 'NO'}`);
                console.log(`  • domain: ${ws.domain || 'NO'}`);

                if (ws.theme) {
                    console.log(`  • theme.heroImageAlt: ${ws.theme.heroImageAlt || 'NO'}`);
                    console.log(`  • theme.heroImageTitle: ${ws.theme.heroImageTitle || 'NO'}`);
                    console.log(`  • theme.heroImageUrl: ${ws.theme.heroImageUrl || 'NO'}`);
                }

                if (ws.general) {
                    console.log(`  • general.subdomain: ${ws.general.subdomain || 'NO'}`);
                }
            } else {
                console.log('- websiteSettings: NO EXISTE o está vacío');
            }
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkDatabase();