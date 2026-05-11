// server.js – Autenticación (Passport.js + Google OAuth + invitado) – Rebeca

const express        = require("express");
const path           = require("path");
const session        = require("express-session");
const passport       = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const WebSocket      = require("ws");

const app  = express();
// Railway asigna el puerto automáticamente por variable de entorno
const PORT = process.env.PORT || 3000;

// La URL base cambia entre local y producción
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.static(path.join(__dirname, "..", "client")));
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || "chat-secreto", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((u, done) => done(null, u));
passport.deserializeUser((u, done) => done(null, u));

// Estrategia Google: obtiene el nombre real del perfil
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  (_, __, profile, done) => done(null, { id: profile.id, name: profile.displayName })
));

// Rutas Google OAuth
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => res.redirect("/")
);

// Invitado: usa el nombre escrito o genera "Usuario_XXXX" automáticamente
app.get("/auth/guest", (req, res) => {
  const name = req.query.name?.trim() || `Usuario_${Math.floor(1000 + Math.random() * 9000)}`;
  req.session.guestUser = name;
  res.json({ name });
});

// Devuelve quién está en sesión activa
app.get("/me", (req, res) => {
  if (req.isAuthenticated())    return res.json({ name: req.user.name });
  if (req.session.guestUser)    return res.json({ name: req.session.guestUser });
  res.json({ name: null });
});

// Cierre de sesión con el botón
app.get("/logout", (req, res) => req.logout(() => { req.session.destroy(); res.redirect("/"); }));

// Cierre brusco del navegador (sendBeacon desde el cliente)
app.post("/leave", (req, res) => {
  const { name } = req.body;
  if (name) broadcast({ type: "leave", name });
  if (req.session?.guestUser) req.session.destroy();
  res.sendStatus(200);
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "client", "index.html")));

// Servidor HTTP + WebSocket
const server = app.listen(PORT, () => console.log(`Servidor en ${BASE_URL}`));
const wss    = new WebSocket.Server({ server });

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try { broadcast(JSON.parse(raw)); } catch {}
  });
});

// TODO (Emerson): descomentar cuando esté lista la base de datos
// const db = require("./db");
// db.saveMessage(name, text) / db.getMessages()