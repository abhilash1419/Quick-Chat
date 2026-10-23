
const socket = io();

const $ = id => document.getElementById(id);
const home = $("home");
const chat = $("chat");
const messages = $("messages");
const nameInput = $("name");

let myName = "";
let joined = false;

function showMessage(message) {
  const bubble = document.createElement("div");
  bubble.className = "bubble" +
    (message.name === myName ? " mine" : "");

  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = message.name;

  const body = document.createElement("div");
  body.textContent = message.text;

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = new Date(message.time)
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

  bubble.append(sender, body, time);
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function joinRoom(id) {
  myName = nameInput.value.trim().slice(0, 24) || "Guest";
  $("homeError").textContent = "";

  socket.emit("join-room", { id, name: myName }, result => {
    if (!result?.ok) {
      $("homeError").textContent =
        result?.error || "Could not join room.";
      return;
    }

    joined = true;
    home.hidden = true;
    chat.hidden = false;
    $("status").textContent = "Chat room";
    messages.replaceChildren();
    result.messages.forEach(showMessage);
  });
}

$("create").addEventListener("click", () => {
  $("homeError").textContent = "";

  socket.emit("create-room", result => {
    if (!result?.id) {
      $("homeError").textContent =
        result?.error || "Could not create room.";
      return;
    }

    const url = new URL(location.href);
    url.searchParams.set("room", result.id);
    $("link").value = url.toString();
    $("share").hidden = false;

    history.replaceState({}, "", url);
    joinRoom(result.id);
  });
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("link").value);
    $("copy").textContent = "Copied!";
  } catch {
    $("link").select();
    $("homeError").textContent =
      "Copy the selected link manually.";
  }
});

$("form").addEventListener("submit", event => {
  event.preventDefault();

  const input = $("text");
  const value = input.value.trim();

  if (!joined || !value) return;

  socket.emit("send-message", value);
  input.value = "";
});

socket.on("new-message", showMessage);

socket.on("presence", users => {
  $("status").textContent =
    `${users.length} participant${users.length === 1 ? "" : "s"} online`;
});

socket.on("connect", () => {
  const id = new URLSearchParams(location.search).get("room");
  if (id && !joined) joinRoom(id);
});

socket.on("disconnect", () => {
  $("status").textContent = "Reconnecting...";
});
       
