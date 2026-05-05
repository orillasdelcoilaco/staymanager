const { generarPropuestaDeEspacio } = require('../../services/logicaEspacios');

const input = {
    tipoEspacio: 'Dormitorio',
    activosSeleccionados: ['Cama Matrimonial', 'Baño en suite', 'TV 55"', 'Vaso de agua'],
};
const resultado = generarPropuestaDeEspacio(input.tipoEspacio, input.activosSeleccionados);

console.log("PROMPT GENERADO:");
console.log(resultado.promptFotos);

const contieneVaso = resultado.promptFotos.includes("Vaso de agua");
const contieneDirector = resultado.promptFotos.includes("Director de Arte");

console.log("Contiene 'Vaso de agua':", contieneVaso);
console.log("Contiene 'Director de Arte':", contieneDirector);
console.log("Requerimientos vacios:", resultado.requerimientosFotos.length === 0);

if (contieneVaso && contieneDirector && resultado.requerimientosFotos.length === 0) {
    console.log("TEST MANUAL PASSED");
} else {
    console.log("TEST MANUAL FAILED");
    process.exit(1);
}
