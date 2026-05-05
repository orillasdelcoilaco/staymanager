const fs = require('fs');
const { generarPropuestaDeEspacio } = require('../../services/logicaEspacios');

const tipo = "Dormitorio";
const activos = ["Cama Matrimonial", "Veladores", "TV", "Closet", "Baño en suite"];
const detalles = "Dormitorio principal con iluminación cálida";

const resultado = generarPropuestaDeEspacio(tipo, activos, detalles);

const output = JSON.stringify(resultado, null, 2);
console.log(output);
fs.writeFileSync('validation_result.json', output);
