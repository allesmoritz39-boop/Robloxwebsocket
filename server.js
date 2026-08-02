const WebSocket = require('ws');
const http = require('http');

// VEREINBARE HIER DEIN GEHEIMES PASSWORT
const AUTH_TOKEN = "LokiBurgerTuffYeahIKnow"; 

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket-Server läuft!');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // Wir lesen den Token aus der URL aus (z.B. wss://://)
  const urlParams = new URL(req.url, `http://${req.headers.host}`);
  const clientToken = urlParams.searchParams.get('token');

  // Überprüfung: Wenn der Token falsch oder leer ist, wird die Verbindung sofort getrennt!
  if (!clientToken || clientToken !== AUTH_TOKEN) {
    console.log('⚠️ Verbindungsversuch abgelehnt: Falscher oder fehlender Token!');
    ws.send('ERROR: Authentifizierung fehlgeschlagen!');
    ws.close();
    return;
  }

  console.log('✅ Roblox erfolgreich mit gültigem Token verbunden!');
  
  ws.on('message', (message) => {
    console.log('Nachricht:', message.toString());
    ws.send('Empfangen: ' + message.toString());
  });
});

server.listen(process.env.PORT || 3000);
