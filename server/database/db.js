const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, "chat.db");

const db = new sqlite3.Database(dbPath, (error) => {
    if (error) {
        console.error("Error al conectar con SQLite:", error.message);
    } else {
        console.log("Base de datos SQLite conectada correctamente.");
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS MENSAJE (
            id_mensaje INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_usuario TEXT NOT NULL,
            contenido TEXT NOT NULL,
            fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function guardarMensaje(nombreUsuario, contenido) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO MENSAJE (nombre_usuario, contenido)
            VALUES (?, ?)
        `;

        db.run(sql, [nombreUsuario, contenido], function (error) {
            if (error) {
                reject(error);
            } else {
                resolve({
                    id_mensaje: this.lastID,
                    nombre_usuario: nombreUsuario,
                    contenido
                });
            }
        });
    });
}

function obtenerUltimosMensajes(limite = 20) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT
                id_mensaje,
                nombre_usuario,
                contenido,
                fecha_envio
            FROM MENSAJE
            ORDER BY id_mensaje DESC
            LIMIT ?
        `;

        db.all(sql, [limite], (error, rows) => {
            if (error) {
                reject(error);
            } else {
                resolve(rows.reverse());
            }
        });
    });
}

module.exports = {
    guardarMensaje,
    obtenerUltimosMensajes
};