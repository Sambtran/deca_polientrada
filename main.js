import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: './datos.env' });
function IniciarLogs(){
// Crear carpeta de logs si no existe
const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Crear nombre único para cada sesión
function timestampFilename() {
    const now = new Date();
    return now.toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
}
const logFilename = `log_${timestampFilename()}.log`;
const logFilePath = path.join(logsDir, logFilename);

// Crear stream de log
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Función para marca de tiempo legible
function timestamp() {
    return new Date().toISOString();
}

// Reemplazar console.log y console.error
const originalLog = console.log;
const originalErr = console.error;

console.log = (...args) => {
    const message = args.join(' ');
    const line = `[${timestamp()}] [LOG] ${message}\n`;
    logStream.write(line);
    originalLog(...args);
};

console.error = (...args) => {
    const message = args.join(' ');
    const line = `[${timestamp()}] [ERROR] ${message}\n`;
    logStream.write(line);
    originalErr(...args);
};

// Manejo de salidas y errores
process.on('uncaughtException', (err) => {
    console.error('Excepción no capturada:', err);
    logStream.end(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
    console.error('Promesa no manejada:', reason);
    logStream.end(() => process.exit(1));
});

process.on('SIGINT', () => {
    console.log('Programa detenido por el usuario (CTRL+C)');
    logStream.end(() => process.exit(0));
});}
IniciarLogs();
import crypto from 'crypto';
import csv from 'csv-parser';
import QRCode from 'qrcode';
import { Client } from 'pg';
import * as readline from "node:readline";
import express from 'express';

const baseOutputDir = './qrcodes';
const qrPerItem = 5;
let servidor = null



const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});







// Conectar y usar
mostrarMenu()






//Funcion que muestra un menu  ¡¡¡¡ PUEDE QUE SE TENGA QUE TOCAR PARAMETROS MAS ADELANTE!!!!
function mostrarMenu() {
    // Crear instancia del cliente de PostgreSQL
    let x= process.env.PG_PASS

    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'deca',
        password:process.env.PG_PASS,
        port: 5432,
    });
    rl.question(
        `\nBienvenido al menú de PoliEntradas\n` +
        `DECIDA QUÉ QUIERE HACER:\n` +
        `1) Insertar usuarios a la base de datos\n` +
        `2) Crear QR\n` +
        `3) Encender servidor de validación QR\n` +
        `4) APAGAR servidor de validación QR\n` +
        `Q) Salir\n> `,
        async (x) => {
            switch (x.toLowerCase()) {
                case '1':
                    await insertarDatos(client); // Asegúrate de que esta función sea async
                    break;
                case '2':
                    await crear_qr(client, "data.csv", 3);
                    break;
                case '3':
                    iniciarServidor(3000)
                    break;
                case '4':
                    detenerServidor(3000)
                    break;
                case 'q':
                    console.log("Saliendo...");
                    rl.close();
                    return;
                default:
                    console.log("Opción no válida.");
            }
            mostrarMenu(); // Repetir menú
        }
    );
}

//FUNCION PROTOTIPO  para insertar nuevas personas a la BBDD
async function insertarDatos(client) {
    await client.connect();
    const estudiantes = [];

    fs.createReadStream('gente.csv')
        .pipe(csv())
        .on('data', (row) => {
            estudiantes.push(row);
        })
        .on('end', async () => {
            for (const est of estudiantes) {
                const { dni, nombre, apellido1, apellido2, carrera } = est;

                try {
                    let x = `INSERT INTO usuarios (id,Nombre,Apellido1,Apellido2) VALUES (`+est.dni+`,'`+est.nombre+`','`+est.apellido1+`','`+est.apellido2+`')`

                    await client.query(x)
                    console.log(`Insertado: ${dni}`);
                } catch (err) {
                    console.error(`Error insertando ${dni}:`, err.message);
                }
            }

            await client.end();
            console.log('Importación completa.');
        });
}

//funcion para crear QR // se guardan en carpeta qrcodes, el parametro archivo recibe un path donde busca el csv, el parametro x es los qr que queremos crear asociados a cada persona
async function crear_qr(client,archivo,x) {
   await client.connect();
    const csvFilePath = archivo.toString();
    const qrPerItem = x;
// Crea la carpeta base si no existe
    if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir);
    }

// Función para crear hash único
    function generateHash(base, index) {
        return crypto.createHash('sha256').update(`${base}_${index}`).digest('hex');
    }

// Leer CSV y procesar
    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', async (row) => {
            const folderName = row.nombre?.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'item';
            const itemFolderPath = path.join(baseOutputDir, folderName);



            for (let i = 0; i < qrPerItem; i++) {
                const hash = generateHash(JSON.stringify(row), i);
                const qrPath = path.join(itemFolderPath, `qr_${i + 1}.png`);
                const z = await client.query(
                    'SELECT * FROM usuarios WHERE id = $1',
                    [row.nombre]
                );

                if (z.rows.length === 0) {
                    console.warn(`Usuario con id "${row.nombre}" no encontrado. Se omite generación de QR.`);
                    return; // Salta al siguiente
                }
                // Crear carpeta por fila
                if (!fs.existsSync(itemFolderPath)) {
                    fs.mkdirSync(itemFolderPath, {recursive: true});
                }
                try {
                    let v=z.rows[0].id;
                    let x= `INSERT INTO "QR" (hash, id_usuario) VALUES ('`+hash+`',`+v+`) `

                    await client.query(x)
                    await QRCode.toFile(qrPath, hash);

                    console.log(`QR generado: ${qrPath}`);
                } catch (err) {
                    console.error('Error generando QR:', err);
                }
            }
        })
        .on('end', () => {
            console.log('Todos los QR han sido generados.');
        });
    await client.end;
}

function iniciarServidor(puerto = 3000) {
    if (servidor) {
        console.log(`El servidor ya está en ejecución en el puerto ${puerto}`);
        return;
    }

    const app = express();
    app.use(express.json());
        //ESTA SECIÓN SE DEBERA MODIFICAR PARA COMPROBAR EL HASH DEL QR CON LA BASE DE DATOS Y DEVOLVER TRUE SI LAS COMRPROBACIONES PERTINTENTES SON CORRECTAS
    app.post('/api/val', (req, res) => {
        console.log('JSON recibido:', req.body);

        res.status(200).send({ mensaje: 'Datos recibidos correctamente' });
    });
    //escucha de puerto
    servidor = app.listen(puerto, () => {
        console.log(`Servidor escuchando en http://localhost:${puerto}`);
    });
}
function detenerServidor() {
    if (servidor) {
        servidor.close(() => {
            console.log('Servidor detenido correctamente.');
            servidor = null;
        });
    } else {
        console.log('No hay servidor en ejecución.');
    }
}
