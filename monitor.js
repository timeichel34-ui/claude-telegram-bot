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

// Exa Search via direktem API Call
async function searchExa(query, days = 1) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const dateStr = startDate.toISOString();

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXA_API_KEY || ''
      },
      body: JSON.stringify({
        query: query,
        numResults: 5,
        startPublishedDate: dateStr,
        useAutoprompt: true
      })
    });

    if (!response.ok) {
      throw new Error(`Exa API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (err) {
    console.error('Exa search failed:', err);
    return [];
  }
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
    const results = await searchExa('Tempelhofer Feld Berlin Bebauung Wohnungen', 1);

    if (results.length === 0) {
      console.log('✅ No new articles found');

      // Update last check
      if (!memory.monitoring) memory.monitoring = {};
      if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
      memory.monitoring.tempelhof.last_check = today;
      saveMemory(memory);

      return; // Silent - keine Notification
    }

    // 2. JINA READER - Top 2 Artikel lesen
    console.log(`📖 Reading top ${Math.min(2, results.length)} articles...`);
    const articles = [];
    for (let i = 0; i < Math.min(2, results.length); i++) {
      const content = await readArticle(results[i].url);
      if (content) {
        articles.push({
          url: results[i].url,
          title: results[i].title,
          content: content.substring(0, 2000)
        });
      }
    }

    // 3. ZUSAMMENFASSUNG erstellen
    const headlines = results.slice(0, 3).map(r => `• ${r.title}`).join('\n');

    // 4. TELEGRAM NOTIFICATION
    const message = `🏗️ *TEMPELHOF UPDATE*\n\n📅 ${today}\n\n*${results.length} neue Artikel gefunden:*\n\n${headlines}\n\n🔗 Top-Link:\n${results[0].url}`;

    await sendTelegramMessage(message);

    // 5. MEMORY UPDATE
    if (!memory.monitoring) memory.monitoring = {};
    if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
    memory.monitoring.tempelhof.last_check = today;
    memory.monitoring.tempelhof.latest_news = {
      date: today,
      articles_found: results.length,
      top_url: results[0].url,
      top_title: results[0].title
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
