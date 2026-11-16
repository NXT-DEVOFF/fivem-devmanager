/**
 * Exemple d'integration du gate de licence dans un bot Discord (discord.js).
 *
 * Copie ce fichier dans ton bot, ajuste les intents/commands, puis :
 *   npm install discord.js dotenv
 *   node bot-gate.example.js
 *
 * Le blocage est total :
 *   - pas de licence valide au demarrage  => le bot ne se connecte meme pas
 *   - licence revoquee/expiree en cours   => client.destroy() + exit(1)
 *   - Keygate coupe mais token encore bon => le bot continue (grace 72h)
 */
require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { enforceLicense, startLicenseWatch } = require("./gate");

// Identifiant stable de l'activation : ne jamais changer pour la meme machine.
// Par defaut : nom de machine. En production, LICENSE_IDENTIFIER dans .env.
const IDENTIFIER = process.env.LICENSE_IDENTIFIER || undefined;

async function main() {
  // 1) Blocage au demarrage : exit(1) si la licence est invalide.
  await enforceLicense({ identifier: IDENTIFIER });

  // 2) Le bot ne se connecte qu'apres validation.
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.on(Events.ClientReady, (ready) => {
    console.log(`[bot] connecte en tant que ${ready.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "ping") {
      await interaction.reply("pong");
    }
  });

  // 3) Surveillance continue : revoquee => le bot s'eteint proprement.
  startLicenseWatch({
    identifier: IDENTIFIER,
    onRevoked: async (result) => {
      console.error(`[bot] licence invalide (${result.reason}) : arret du bot.`);
      client.destroy();
      process.exit(1);
    },
  });

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  console.error("[bot] demarrage impossible:", error.message || error);
  process.exit(1);
});
