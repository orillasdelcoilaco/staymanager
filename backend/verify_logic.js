const { contarDistribucion } = require('./services/propiedadLogicService');

const testCases = [
    {
        name: "User Example Cabaña 1",
        componentes: [
            { nombre: "Dormitorio Principal", tipo: "Dormitorio" },
            { nombre: "Baño en Suite Dormitorio Principal", tipo: "Baño" }, // Or 'Otro' if AI failed mapping
            { nombre: "Dormitorio Doble", tipo: "Dormitorio" },
            { nombre: "Baño Compartido", tipo: "Baño" },
            { nombre: "Cocina Abierta", tipo: "Cocina" },
            { nombre: "Sala de Estar y Comedor Integrados", tipo: "Sala de Estar" },
            { nombre: "Tinaja Privada Exterior", tipo: "Tinaja" },
            { nombre: "Estación de Parrilla Exterior", tipo: "Parrilla" }
        ]
    },
    {
        name: "Edge Case: Type is Name (AI Default)",
        componentes: [
            { nombre: "Dormitorio Principal", tipo: "Dormitorio Principal" },
            { nombre: "Baño en Suite Dormitorio Principal", tipo: "Baño en Suite Dormitorio Principal" },
            { nombre: "Dormitorio Doble", tipo: "Dormitorio Doble" },
            { nombre: "Baño Compartido", tipo: "Baño Compartido" }
        ]
    },
    {
        name: "Edge Case: En Suite Bedroom (Implicit Bath)",
        componentes: [
            { nombre: "Dormitorio Principal en Suite", tipo: "Dormitorio" }
        ]
    }
];

const results = testCases.map(test => ({
    name: test.name,
    result: contarDistribucion(test.componentes)
}));
console.log(JSON.stringify(results, null, 2));
