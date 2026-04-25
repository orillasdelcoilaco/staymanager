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

// resolver unidad reservable desde id de catálogo (chatgpt)
router.post("/reservas/resolve-booking-unit", controller.resolveBookingUnit);

// cotizar reserva (dry-run, sin persistir)
router.post("/reservas/cotizar", controller.cotizarReserva);

// crear reserva
router.post("/reservas", controller.crearReserva);

// [NEW] Configuración de Agente
router.get("/agent-config", controller.agentConfig);

module.exports = router;
