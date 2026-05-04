const { exec } = require('child_process');
const path = require('path');

function generateAgentForCompany(empresaId, nombreEmpresa) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'create-agent.js');

        const command = `node "${scriptPath}" --empresaId=${empresaId} --nombre="${nombreEmpresa}"`;

        console.log(`\n⚙️ Generando agente automáticamente para empresa: ${empresaId}\n`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Error generando agente:', error);
                return reject(error);
            }
            if (stderr) {
                console.error('⚠️ Advertencia:', stderr);
            }

            console.log(stdout);
            resolve(stdout);
        });
    });
}

module.exports = {
    generateAgentForCompany
};
