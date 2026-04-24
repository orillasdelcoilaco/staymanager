const express = require("express");
const router = express.Router();
const controller = require("../services/suitemanagerApiController"); // Importar controlador
const { lookupEmpresaForAgentQuery } = require("../services/agentEmpresaLookupService");
const fs = require("fs");
const path = require("path");

// Endpoint Marketplace Global
router.get("/busqueda-general", controller.busquedaGeneral);

router.get("/buscar-empresa", async (req, res) => {
    try {
        const query = req.query.q?.trim();
        if (!query) {
            return res.status(400).json({ error: "Missing q parameter" });
        }

        const found = await lookupEmpresaForAgentQuery(query);

        if (found?.id) {
            const agentPath = path.join(
                __dirname,
                `../../ai/agentes/empresa/${found.id}.md`
            );

            let agentContent = "";
            if (fs.existsSync(agentPath)) {
                agentContent = fs.readFileSync(agentPath, "utf8");
            }

            return res.json({
                success: true,
                empresaId: found.id,
                nombre: found.nombre || found.id,
                agentContent,
            });
        }

        return res.json({
            success: false,
            empresaId: null,
            agentContent: "",
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
