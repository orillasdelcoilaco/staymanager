const { generarPropuestaDeEspacio } = require('../../services/logicaEspacios');

const inputSpanglish = {
    tipo: "Master Suite",
    activos: ["King Bed", "Walking Closet"],
    detalles: "Vista al mar"
};

const resultado = generarPropuestaDeEspacio(inputSpanglish.tipo, inputSpanglish.activos, inputSpanglish.detalles);

console.log("--- TEST SPANGLISH ---");
console.log("Input Tipo:", inputSpanglish.tipo);
console.log("Output H1:", resultado.seo.h1);
console.log("Output Title:", resultado.seo.title);
console.log("Output Desc:", resultado.seo.metaDescription);

if (resultado.seo.h1.includes("Dormitorio Principal") && !resultado.seo.h1.includes("Master Suite")) {
    console.log("SUCCESS: Translated correctly.");
} else {
    console.log("FAIL: Translation missing.");
}
