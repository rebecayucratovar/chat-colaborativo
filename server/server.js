// server.js – Autenticación (Passport.js + Google OAuth + invitado) + WebSocket + SQLite

const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const WebSocket = require("ws");

const { guardarMensaje, obtenerUltimosMensajes } = require("./database/db");

const app = express();

const PORT = parseInt(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.static(path.join(__dirname, "..", "client")));
app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET || "chat-secreto",
        resave: false,
        saveUninitialized: false
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((u, done) => done(null, u));
passport.deserializeUser((u, done) => done(null, u));

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${BASE_URL}/auth/google/callback`
        },
        (_, __, profile, done) =>
            done(null, {
                id: profile.id,
                name: profile.displayName
            })
    )
);

app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => res.redirect("/")
);

app.get("/auth/guest", (req, res) => {
    const name =
        req.query.name?.trim() ||
        `Usuario_${Math.floor(1000 + Math.random() * 9000)}`;

    req.session.guestUser = name;
    res.json({ name });
});

app.get("/me", (req, res) => {
    if (req.isAuthenticated()) return res.json({ name: req.user.name });
    if (req.session.guestUser) return res.json({ name: req.session.guestUser });

    res.json({ name: null });
});

app.get("/logout", (req, res) =>
    req.logout(() => {
        req.session.destroy();
        res.redirect("/");
    })
);

app.post("/leave", (req, res) => {
    const { name } = req.body;

    if (name) {
        broadcast({ type: "leave", name });
    }

    if (req.session?.guestUser) {
        req.session.destroy();
    }

    res.sendStatus(200);
});

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "..", "client", "index.html"))
);

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor escuchando en 0.0.0.0:${PORT} — ${BASE_URL}`);
});

const wss = new WebSocket.Server({ server });

function broadcast(data) {
    const msg = JSON.stringify(data);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

wss.on("connection", async (ws) => {
    console.log("Nuevo cliente conectado");

    try {
        const historial = await obtenerUltimosMensajes(20);

        historial.forEach((mensaje) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                    JSON.stringify({
                        type: "message",
                        name: mensaje.nombre_usuario,
                        text: mensaje.contenido
                    })
                );
            }
        });
    } catch (error) {
        console.error("Error al cargar historial:", error.message);
    }

    ws.on("message", async (raw) => {
        try {
            const data = JSON.parse(raw);

            if (data.type === "message") {
                await guardarMensaje(data.name || "Usuario", data.text || "");
                console.log("Mensaje guardado en SQLite:", data.name, data.text);
            }

            broadcast(data);
        } catch (error) {
            console.error("Error procesando mensaje:", error.message);
        }
    });
});