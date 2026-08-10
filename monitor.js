require('dotenv').config();
const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

// Exa Search ausführen
async function searchExa(query, days = 1) {
  return new Promise((resolve, reject) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateStr = startDate.toISOString().split('T')[0];

    const cmd = spawn('bash', ['-c', `mcporter call exa.web_search_exa query="${query}" numResults=5 useAutoprompt=true startPublishedDate="${dateStr}"`]);

    let output = '';
    cmd.stdout.on('data', (data) => { output += data.toString(); });
    cmd.stderr.on('data', (data) => { console.error('Exa error:', data.toString()); });
    cmd.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Exa failed: ${code}`));
    });
  });
}

// Jina Reader für Artikel-Details
async function readArticle(url) {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`);
    return await response.text();
  } catch (err) {
    console.error('Jina error:', err);
    return null;
  }
}

// Tempelhof News recherchieren
async function checkTempelhofNews() {
  console.log('🔍 Starting DEEP Tempelhof research...');

  const memory = loadMemory();
  if (!memory) return;

  const today = new Date().toISOString().split('T')[0];
  const lastCheck = memory.monitoring?.tempelhof?.last_check;

  try {
    // 1. EXA SEARCH - News Artikel
    console.log('📰 Searching news articles...');
    const newsResults = await searchExa('Tempelhofer Feld Berlin Bebauung Wohnungen', 1);

    // Parse URLs aus Exa Results
    const urlRegex = /URL: (https?:\/\/[^\s]+)/g;
    const urls = [];
    let match;
    while ((match = urlRegex.exec(newsResults)) !== null) {
      urls.push(match[1]);
    }

    if (urls.length === 0) {
      console.log('✅ No new articles found');

      // Update last check
      if (!memory.monitoring) memory.monitoring = {};
      if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
      memory.monitoring.tempelhof.last_check = today;
      saveMemory(memory);

      return; // Silent - keine Notification
    }

    // 2. JINA READER - Top 2 Artikel lesen
    console.log(`📖 Reading top ${Math.min(2, urls.length)} articles...`);
    const articles = [];
    for (let i = 0; i < Math.min(2, urls.length); i++) {
      const content = await readArticle(urls[i]);
      if (content) {
        articles.push({ url: urls[i], content: content.substring(0, 2000) });
      }
    }

    // 3. ZUSAMMENFASSUNG erstellen
    const headlines = newsResults.match(/Title: ([^\n]+)/g)?.slice(0, 3) || [];
    const summary = headlines.map(h => `• ${h.replace('Title: ', '')}`).join('\n');

    // 4. TELEGRAM NOTIFICATION
    const message = `🏗️ *TEMPELHOF UPDATE*\n\n📅 ${today}\n\n*${urls.length} neue Artikel gefunden:*\n\n${summary}\n\n🔗 Top-Link:\n${urls[0]}`;

    await sendTelegramMessage(message);

    // 5. MEMORY UPDATE
    if (!memory.monitoring) memory.monitoring = {};
    if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
    memory.monitoring.tempelhof.last_check = today;
    memory.monitoring.tempelhof.latest_news = {
      date: today,
      articles_found: urls.length,
      top_url: urls[0]
    };
    saveMemory(memory);

    console.log('✅ Deep research complete - notification sent!');

  } catch (err) {
    console.error('❌ Research failed:', err);
    await sendTelegramMessage(`⚠️ Tempelhof-Check fehlgeschlagen: ${err.message}`);
  }
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
