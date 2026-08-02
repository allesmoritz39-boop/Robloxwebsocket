const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket-Server läuft!');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Roblox verbunden!');
  ws.on('message', (message) => {
    console.log('Nachricht:', message.toString());
    ws.send('Empfangen: ' + message.toString());
  });
});

server.listen(process.env.PORT || 3000);
