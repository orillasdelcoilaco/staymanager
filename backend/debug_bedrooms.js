const { contarDistribucion } = require('./services/propiedadLogicService');

const componentes = [
    { nombre: "Dormitorio Principal", tipo: "Dormitorio" },
    { nombre: "Baño en Suite Dormitorio Principal", tipo: "Baño" },
    { nombre: "Dormitorio Doble", tipo: "Dormitorio" },
    { nombre: "Baño Compartido", tipo: "Baño" },
    { nombre: "Cocina Abierta", tipo: "Cocina" },
    { nombre: "Sala de Estar y Comedor Integrados", tipo: "Sala de Estar" },
    { nombre: "Tinaja Privada Exterior", tipo: "Tinaja" },
    { nombre: "Estación de Parrilla Exterior", tipo: "Parrilla" }
];

const result = contarDistribucion(componentes);
console.log(JSON.stringify(result, null, 2));
