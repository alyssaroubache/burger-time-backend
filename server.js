const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = initSocket(server);
app.set('socketio', io); // rend io accessible dans les contrôleurs

server.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});