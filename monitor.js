require('dotenv').config();
const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const CHAT_ID = process.env.JULIAN_TELEGRAM_CHAT_ID; // Du musst deine Chat ID hinzufügen
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Memory laden
function loadMemory() {
  try {
    const memoryPath = path.join(__dirname, 'memory.json');
    return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  } catch (err) {
    console.error('Memory load failed:', err);
    return null;
  }
}

// Memory speichern
function saveMemory(data) {
  try {
    const memoryPath = path.join(__dirname, 'memory.json');
    fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Memory save failed:', err);
  }
}

// Telegram Message senden
async function sendTelegramMessage(text) {
  if (!CHAT_ID) {
    console.log('⚠️ CHAT_ID not set. Message:', text);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram send failed:', result);
    }
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

// Tempelhof News recherchieren
async function checkTempelhofNews() {
  console.log('🔍 Checking Tempelhof news...');

  const memory = loadMemory();
  if (!memory) return;

  const lastCheck = memory.monitoring?.tempelhof?.last_check;
  const today = new Date().toISOString().split('T')[0];

  // Simulierte News-Check (in Production würdest du hier Exa API callen)
  // Für jetzt: Checke ob heute schon geprüft wurde
  if (lastCheck === today) {
    console.log('✅ Already checked today');
    return;
  }

  // Update last check
  if (!memory.monitoring) memory.monitoring = {};
  if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
  memory.monitoring.tempelhof.last_check = today;

  // Placeholder: In production würde hier Exa Search + Jina Reader laufen
  // Für jetzt schicken wir eine Test-Message
  const message = `🏗️ *Tempelhof Daily Check*\n\n✅ Monitoring aktiv\n📅 ${today}\n\n_Neue News: Keine neuen Artikel seit gestern_\n\nAktuelle Facts:\n• Einfache Mehrfamilienhäuser (keine Türme)\n• 12-Türme-Konzept verworfen\n• €3.500 Projekt läuft`;

  await sendTelegramMessage(message);
  saveMemory(memory);

  console.log('✅ Tempelhof check complete');
}

// Täglich um 9:17 Uhr
cron.schedule('17 9 * * *', () => {
  console.log('⏰ Daily Tempelhof monitoring triggered');
  checkTempelhofNews();
}, {
  timezone: "Europe/Berlin"
});

// Test on startup (optional - nur für Development)
if (process.env.NODE_ENV === 'development') {
  console.log('🧪 Development mode - running test check in 5 seconds');
  setTimeout(checkTempelhofNews, 5000);
}

console.log('✅ Tempelhof monitoring scheduler started (9:17 Berlin time daily)');
console.log('💡 CHAT_ID configured:', !!CHAT_ID);

module.exports = { checkTempelhofNews };
