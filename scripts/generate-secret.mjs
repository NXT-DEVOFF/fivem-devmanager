/** Genere APP_ENCRYPTION_KEY et APP_SECRET pour le fichier .env. */
import crypto from "node:crypto";

const encryptionKey = crypto.randomBytes(32).toString("base64");
const appSecret = crypto.randomBytes(48).toString("base64url");

console.log("# Ajoutez ces lignes dans votre fichier .env (ne les commitez jamais)\n");
console.log(`APP_ENCRYPTION_KEY=${encryptionKey}`);
console.log(`APP_SECRET=${appSecret}`);
