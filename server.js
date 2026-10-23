
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = new Map();
const ROOM_TTL = 30 * 60 * 1000;

io.on("connection", socket => {
  socket.on("create-room", callback => {
    const id = crypto.randomBytes(16).toString("hex");
    rooms.set(id, {
      messages: [],
      users: new Map(),
      lastActive: Date.now()
    });
    callback({ id });
  });

  socket.on("join-room", ({ id, name }, callback) => {
    const room = rooms.get(id);
    if (!room) return callback({ error: "Room expired or not found." });
    if (room.users.size >= 2 && !room.users.has(socket.id)) {
      return callback({ error: "Room is full." });
    }

    socket.data.roomId = id;
    socket.data.name = String(name || "Guest").slice(0, 24);
    socket.join(id);
    room.users.set(socket.id, socket.data.name);
    room.lastActive = Date.now();

    callback({ ok: true, messages: room.messages });
    io.to(id).emit("presence", [...room.users.values()]);
  });

  socket.on("send-message", text => {
    const id = socket.data.roomId;
    const room = rooms.get(id);
    if (!room || !room.users.has(socket.id)) return;
    if (typeof text !== "string") return;

    text = text.trim().slice(0, 2000);
    if (!text) return;

    const message = {
      id: crypto.randomUUID(),
      name: socket.data.name,
      text,
      time: Date.now()
    };

    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();

    room.lastActive = Date.now();
    io.to(id).emit("new-message", message);
  });

  socket.on("disconnect", () => {
    const id = socket.data.roomId;
    const room = rooms.get(id);
    if (!room) return;

    room.users.delete(socket.id);
    room.lastActive = Date.now();
    io.to(id).emit("presence", [...room.users.values()]);

    if (room.users.size === 0) rooms.delete(id);
  });
});

setInterval(() => {
  for (const [id, room] of rooms) {
    if (Date.now() - room.lastActive > ROOM_TTL) {
      rooms.delete(id);
    }
  }
}, 60_000).unref();

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("QuickChat server running on port " + PORT);
});
