// script.js – Cliente WebSocket – Rebeca
// Maneja login (Google/invitado), mensajes y notificaciones de entrada/salida.

let socket, myName, loggingOut = false;

// Al cargar: verificar si ya hay sesión activa
window.addEventListener("DOMContentLoaded", async () => {
  const { name } = await fetch("/me").then(r => r.json());
  if (name) startChat(name);

  document.getElementById("guest-name")
    .addEventListener("keydown", e => e.key === "Enter" && enterAsGuest());
});

// Entrar como invitado (nombre vacío → servidor asigna "Usuario_XXXX")
async function enterAsGuest() {
  const input = document.getElementById("guest-name").value.trim();
  const { name } = await fetch(`/auth/guest?name=${encodeURIComponent(input)}`).then(r => r.json());
  startChat(name);
}

function startChat(name) {
  myName = name;
  document.getElementById("login-screen").style.display  = "none";
  document.getElementById("chat-screen").style.display   = "flex";
  document.getElementById("username-display").textContent = `· ${name}`;

  // Usa wss:// si la página está en HTTPS (producción), ws:// si está en HTTP (local)
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}`);

  socket.onopen    = () => socket.send(JSON.stringify({ type: "join", name }));
  socket.onmessage = e  => addMsg(JSON.parse(e.data));
  socket.onclose   = () => addMsg({ type: "system", text: "Desconectado del servidor." });

  document.getElementById("msg-input")
    .addEventListener("keydown", e => e.key === "Enter" && sendMessage());

  window.addEventListener("beforeunload", () => {
    if (!loggingOut)
      navigator.sendBeacon("/leave", new Blob([JSON.stringify({ name })], { type: "application/json" }));
  });
}

function sendMessage() {
  const el  = document.getElementById("msg-input");
  const text = el.value.trim();
  if (!text) return;
  socket.send(JSON.stringify({ type: "message", name: myName, text }));
  el.value = "";
}

function addMsg(data) {
  const box = document.getElementById("chat-box");
  const div = document.createElement("div");

  if (data.type === "message") {
    div.className = `msg ${data.name === myName ? "own" : "other"}`;
    div.innerHTML = `<div class="sender">${data.name}</div>${esc(data.text)}`;
  } else {
    div.className   = "msg system";
    div.textContent = data.type === "join"  ? `${data.name} se unió al chat`  :
                      data.type === "leave" ? `${data.name} salió del chat`   : data.text;
  }

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function logout() {
  loggingOut = true;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "leave", name: myName }));
    socket.close();
  }
  window.location.href = "/logout";
}

const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");