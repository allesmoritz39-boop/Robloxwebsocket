const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Set();
const recentFinds = []; // hier speichern wir die besten Brainrots + JobIds für später

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[+] Client verbunden | Online: ${clients.size}`);

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "join") {
        console.log(`Join: ${data.player} | JobId: ${data.jobId}`);
      }

      if (data.type === "best_brainrot") {
        // Speichern für später (Brainrot Name + JobId)
        const entry = {
          name: data.name,
          value: data.value,
          priority: data.priority,
          jobId: data.jobId,
          player: data.player,
          time: Date.now()
        };

        recentFinds.unshift(entry);
        if (recentFinds.length > 50) recentFinds.pop(); // max 50 behalten

        console.log(`[BEST] ${data.name} ($${data.value}) | JobId: ${data.jobId}`);
        
        // Optional: an alle anderen Clients weiterleiten
        broadcast({
          type: "new_find",
          ...entry
        }, ws);
      }
    } catch (e) {
      console.log("Parse Error:", e.message);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[-] Client getrennt | Online: ${clients.size}`);
  });
});

// Alle 15 Sekunden Smart-Hop Signal an alle Scanner
setInterval(() => {
  if (clients.size === 0) return;

  const msg = JSON.stringify({
    type: "smart_hop",
    time: Date.now()
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

  console.log(`[HOP] Smart-Hop Signal an ${clients.size} Clients gesendet`);
}, 15000);

// Broadcast Helper
function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Optional: einfache HTTP Route um die letzten Finds zu sehen
server.on("request", (req, res) => {
  if (req.url === "/finds") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(recentFinds, null, 2));
  } else {
    res.writeHead(200);
    res.end("Roblox WebSocket Server läuft");
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
