const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Set();
const recentFinds = [];
const activeAccounts = new Map(); // playerName → { jobId, lastUpdate, ws }

// Alte Einträge aufräumen
setInterval(() => {
  const now = Date.now();
  for (const [player, data] of activeAccounts) {
    if (now - data.lastUpdate > 90000) {
      activeAccounts.delete(player);
    }
  }
}, 20000);

function getOccupiedJobIds() {
  const ids = new Set();
  for (const data of activeAccounts.values()) {
    if (data.jobId) ids.add(data.jobId);
  }
  return Array.from(ids);
}

function getAccountsOnJobId(jobId) {
  const list = [];
  for (const [player, data] of activeAccounts) {
    if (data.jobId === jobId) list.push(player);
  }
  return list;
}

function broadcastOccupied() {
  const occupied = getOccupiedJobIds();
  const msg = JSON.stringify({
    type: "occupied_servers",
    jobIds: occupied,
    time: Date.now()
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Prüft ob mehrere Accounts auf demselben Server sind und schickt Force-Hop
function checkDuplicates() {
  const jobIdCount = new Map();

  for (const [player, data] of activeAccounts) {
    if (!data.jobId) continue;
    if (!jobIdCount.has(data.jobId)) jobIdCount.set(data.jobId, []);
    jobIdCount.get(data.jobId).push(player);
  }

  for (const [jobId, players] of jobIdCount) {
    if (players.length >= 2) {
      // Sortiere alphabetisch → der "kleinere" Name muss hoppen
      players.sort();
      const mustHop = players[0]; // der erste in der Liste hoppt

      console.log(`[DUPLICATE] JobId ${jobId} hat ${players.length} Accounts → ${mustHop} muss hoppen`);

      // Sende Force-Hop nur an den betroffenen Account
      for (const [player, data] of activeAccounts) {
        if (player === mustHop && data.ws && data.ws.readyState === WebSocket.OPEN) {
          data.ws.send(JSON.stringify({
            type: "force_hop",
            reason: "duplicate_account",
            jobId: jobId
          }));
        }
      }
    }
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[+] Client verbunden | Online: ${clients.size}`);

  ws.send(JSON.stringify({
    type: "occupied_servers",
    jobIds: getOccupiedJobIds(),
    time: Date.now()
  }));

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "join") {
        activeAccounts.set(data.player, {
          jobId: data.jobId,
          lastUpdate: Date.now(),
          ws: ws
        });
        console.log(`Join: ${data.player} | JobId: ${data.jobId} | Aktive: ${activeAccounts.size}`);
        broadcastOccupied();
        checkDuplicates(); // ← hier wird geprüft
      }

      if (data.type === "best_brainrot") {
        const entry = {
          name: data.name,
          value: data.value || 0,
          jobId: data.jobId,
          player: data.player,
          time: Date.now()
        };
        recentFinds.unshift(entry);
        if (recentFinds.length > 50) recentFinds.pop();

        console.log(`[BEST] ${data.name} | JobId: ${data.jobId}`);

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
    // Optional: Account entfernen wenn Verbindung weg ist
    for (const [player, data] of activeAccounts) {
      if (data.ws === ws) {
        activeAccounts.delete(player);
        break;
      }
    }
    console.log(`[-] Client getrennt | Online: ${clients.size}`);
  });
});

// Alle 12 Sekunden Hop-Signal + Occupied
setInterval(() => {
  if (clients.size === 0) return;

  const occupied = getOccupiedJobIds();
  const msg = JSON.stringify({
    type: "smart_hop",
    occupied: occupied,
    time: Date.now()
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

  // Auch hier nochmal auf Duplikate prüfen
  checkDuplicates();

  console.log(`[HOP] Signal an ${clients.size} Clients | Occupied: ${occupied.length}`);
}, 12000);

function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

server.on("request", (req, res) => {
  if (req.url === "/finds") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(recentFinds, null, 2));
  } else if (req.url === "/accounts") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const list = [];
    for (const [player, data] of activeAccounts) {
      list.push({ player, jobId: data.jobId, lastUpdate: data.lastUpdate });
    }
    res.end(JSON.stringify(list, null, 2));
  } else {
    res.writeHead(200);
    res.end("Roblox WebSocket Server läuft");
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
