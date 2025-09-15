const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Sirve la carpeta 'frontend' como contenido estático
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Ruta principal que envía el index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor de prueba escuchando en http://localhost:${PORT}`);
});

