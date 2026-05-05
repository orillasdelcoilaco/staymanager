
const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('d:/pmeza/Desarrollos Render/staymanager/backend/serviceAccountKey.json'))
        });
    } catch (e) {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
    let output = "";

    // 1. Find the company that owns 'cabana2'
    const empresas = await db.collection('empresas').get();

    for (const emp of empresas.docs) {
        const propRef = db.collection('empresas').doc(emp.id).collection('propiedades').doc('cabana2');
        const doc = await propRef.get();
        if (doc.exists) {
            output += `FOUND Property 'cabana2' in Company: ${emp.id}\n`;
            const data = doc.data();
            output += `Nombre: ${data.nombre}\n`;
            output += `Capacidad Manual: ${data.capacidad}\n`;
            output += `Capacidad Calculada: ${data.calculated_capacity}\n`;

            output += "\n--- COMPONENTS ---\n";
            data.componentes.forEach((comp, i) => {
                output += `[${i}] ${comp.nombre || comp.tipo}\n`;
                if (comp.elementos) {
                    comp.elementos.forEach(el => {
                        output += `    -> Item: "${el.nombre}" | Qty: ${el.cantidad} | Cap: ${el.capacity} | HasProp: ${el.hasOwnProperty('capacity')}\n`;
                    });
                }
            });
            fs.writeFileSync('d:/pmeza/Desarrollos Render/staymanager/debug_out.txt', output, 'utf8');
            console.log("Written to debug_out.txt");
            return;
        }
    }
    fs.writeFileSync('d:/pmeza/Desarrollos Render/staymanager/debug_out.txt', "Property 'cabana2' NOT FOUND in any company.", 'utf8');
}

run().catch(console.error);
