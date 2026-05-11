// server.js – Autenticación (Passport.js + Google OAuth + invitado) – Rebeca

const express        = require("express");
const path           = require("path");
const session        = require("express-session");
const passport       = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const WebSocket      = require("ws");

const app  = express();

// Railway asigna el puerto por variable de entorno — NUNCA hardcodear
const PORT = parseInt(process.env.PORT) || 3000;

// La URL base cambia entre local y producción
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.static(path.join(__dirname, "..", "client")));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "chat-secreto",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((u, done) => done(null, u));
passport.deserializeUser((u, done) => done(null, u));

// Estrategia Google OAuth
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${BASE_URL}/auth/google/callback`
  },
  (_, __, profile, done) => done(null, { id: profile.id, name: profile.displayName })
));

// Rutas Google OAuth
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => res.redirect("/")
);

// Invitado
app.get("/auth/guest", (req, res) => {
  const name = req.query.name?.trim() || `Usuario_${Math.floor(1000 + Math.random() * 9000)}`;
  req.session.guestUser = name;
  res.json({ name });
});

// Sesión activa
app.get("/me", (req, res) => {
  if (req.isAuthenticated())  return res.json({ name: req.user.name });
  if (req.session.guestUser)  return res.json({ name: req.session.guestUser });
  res.json({ name: null });
});

// Logout
app.get("/logout", (req, res) => req.logout(() => { req.session.destroy(); res.redirect("/"); }));

// Cierre brusco del navegador
app.post("/leave", (req, res) => {
  const { name } = req.body;
  if (name) broadcast({ type: "leave", name });
  if (req.session?.guestUser) req.session.destroy();
  res.sendStatus(200);
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "client", "index.html")));

// Escuchar en 0.0.0.0 es OBLIGATORIO en Railway
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`Servidor escuchando en 0.0.0.0:${PORT} — ${BASE_URL}`)
);

const wss = new WebSocket.Server({ server });

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try { broadcast(JSON.parse(raw)); } catch {}
  });
});