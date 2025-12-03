const express = require("express");
const router = express.Router();
const { detectEmpresaIdFromText } = require("../../ai/router/empresaNameDetector");
const fs = require("fs");
const path = require("path");

router.get("/buscar-empresa", async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: "Missing q parameter" });
        }

        // El modulo exporta detectEmpresaIdFromText, no la funcion por defecto
        const empresaId = detectEmpresaIdFromText(query);

        if (empresaId) {
            const agentPath = path.join(
                __dirname,
                `../../ai/agentes/empresa/${empresaId}.md`
            );

            let agentContent = "";
            if (fs.existsSync(agentPath)) {
                agentContent = fs.readFileSync(agentPath, "utf8");
            }

            return res.json({
                success: true,
                empresaId: empresaId,
                nombre: empresaId, // Placeholder
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
