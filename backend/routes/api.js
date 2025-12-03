const express = require("express");
const router = express.Router();
const controller = require("../services/suitemanagerApiController");

// disponibilidad
router.get("/disponibilidad", controller.disponibilidad);

// detalle alojamiento
router.get("/alojamientos/detalle", controller.detalle);

// alternativas
router.get("/alojamientos/alternativas", controller.alternativas);

// imagenes por alojamiento
router.get("/alojamientos/imagenes", controller.imagenes);

// crear reserva
router.post("/reservas", controller.crearReserva);

module.exports = router;
