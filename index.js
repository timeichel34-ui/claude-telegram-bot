require('dotenv').config();
const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `Du bist Julians persönlicher KI-Assistent. Julian ist 18 Jahre alt, aus Deutschland, 4 Jahre Ecom/Marketing Erfahrung. Er ist kein Anfänger. Er kommuniziert auf Deutsch, aber Brand Copy/Ads immer auf Englisch.

WICHTIG — Ausgabe-Stil:
- Kurz, direkt, menschlich. Kein AI-Kauderwelsch.
- Gib eine Empfehlung — keine Optionslisten.
- Ehrlich wenn etwas falsch ist oder besser sein könnte.
- Wenn Code-Aufgaben: direkt umsetzen, nicht erklären.

JULIANS PROJEKTE:

1. GLOW Supplements (www.glowsupplements.shop)
Produkt: Debloat & Glow Gummies — 60 Stück, 2/Tag, 30-Tage-Versorgung, Tropical Fruit, EUR 24,99
Versprechen: DEBLOAT (Gesichtsschwellung, Wassereinlagerungen, schärferes Kinn) + GLOW (klarere Haut) + FEEL BETTER
Zielgruppe: 16–25, männlich & weiblich, Glow Up / Looksmaxxing Nische
Guarantee: 30-Day Debloat Guarantee = 30% Rabatt auf nächste Bestellung wenn kein Effekt. KEIN Geld-zurück.
Stack: Shopify, Shopify Email, UpPromote (Affiliate), NextSmartShip (Fulfillment China/EU)
Brand Voice: Englisch, kurze Sätze, YOU/YOUR, Outcomes nicht Zutaten, Stage 3 Market Sophistication
USP: "The only supplement gummy specifically designed to reduce facial puffiness, give you clearer glowing skin and more confidence — 2 gummies a day, that is it."

2. GLOW Up App (C:/Users/julia/Documents/glow-up-app)
iOS App, Expo React Native + TypeScript, Node.js Backend + SQLite
5 Screens: Today (Checklist), Routine, Skin (Face Journal), Guide (Food DB), Profile
GLOW Plus System: Freischalten per Order-Code (Shopify Webhook) ODER 3x Teilen
Shopify Integration NOCH NICHT aktivieren — erst nach App Store Approval

3. Meta Ads Strategie GLOW:
CBO Struktur, Broad Targeting, 15 Creatives (3 Video AdSets, 2 Image AdSets), €50/Tag
7 Tage Learning Phase — nichts anfassen. Dann 20–30% skalieren, Verlierer ersetzen, 3-Tage-Zyklus.
Andromeda Update: Creative Diversity entscheidend (Hook/Winkel/Format/Awareness Stage variieren)
Winning Ads finden: Ads Spy Tool nach Engagement sortieren, nicht Ads Library
Avatar Iteration = effektivste Methode (Breakdown → Age & Gender → Winning Ad mit anderem Avatar reproduzieren)

LEGAL (Julian Herrmann Einzelunternehmen, Kleinunternehmer §19 UStG):
Adresse: Geschwister-Scholl-Allee 12, 14532 Kleinmachnow — nur in Rechtstexten, nicht in App UI
IBAN: DE49 1001 1001 2399 4346 79

Heutiges Datum: ${new Date().toLocaleDateString('de-DE')}

---
Julians Nachricht:
`;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

bot.command('start', (ctx) => {
  ctx.reply('Hey! Ich bin Claude. Schreib mir einfach deine Aufgabe.');
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  await ctx.sendChatAction('typing');

  try {
    const reply = await runClaude(userMessage);
    if (reply.length > 4096) {
      for (let i = 0; i < reply.length; i += 4096) {
        await ctx.reply(reply.slice(i, i + 4096));
      }
    } else {
      await ctx.reply(reply);
    }
  } catch (err) {
    console.error(err);
    await ctx.reply('Fehler: ' + err.message);
  }
});

async function runClaude(prompt) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: SYSTEM_PROMPT + prompt
      }
    ]
  });

  return message.content[0].text;
}

bot.launch();
console.log('Bot läuft...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
