#!/usr/bin/env node
// Genera un hash de contraseña para Airtable (campo PasswordHash)
// Uso: node scripts/generate-user-hash.js "password"

import { randomBytes, scryptSync } from "crypto";

const password = process.argv[2];
if (!password) {
  console.error("Uso: node scripts/generate-user-hash.js <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = scryptSync(password, salt, 64);
const hash = `${salt.toString("hex")}:${derived.toString("hex")}`;
console.log("PasswordHash =>", hash);
console.log("Campos sugeridos para Airtable:");
console.log({
  Nombre: "Admin",
  Email: "admin@supertiendageek.com",
  Usuario: "admin",
  Rol: "admin",
  Activo: true,
  PasswordHash: hash,
});
