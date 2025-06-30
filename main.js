// importar dependencias como ES modules
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import csv from 'csv-parser';
import QRCode from 'qrcode';
import { Client } from 'pg';
import * as readline from "node:readline";

const baseOutputDir = './qrcodes';
const qrPerItem = 5;


// Crear instancia del cliente de PostgreSQL
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'deca',
    password: '?',
    port: 5432,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
// Conectar y usar
mostrarMenu()






//Funcion que muestra un menu  ¡¡¡¡ PUEDE QUE SE TENGA QUE TOCAR PARAMETROS MAS ADELANTE!!!!
function mostrarMenu() {
    rl.question(
        `\nBienvenido al menú de PoliEntradas\n` +
        `DECIDA QUÉ QUIERE HACER:\n` +
        `1) Insertar usuarios a la base de datos\n` +
        `2) Crear QR\n` +
        `Q) Salir\n> `,
        async (x) => {
            switch (x.toLowerCase()) {
                case '1':
                    await insertarDatos(client); // Asegúrate de que esta función sea async
                    break;
                case '2':
                    await crear_qr(client, "data.csv", 3);
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
