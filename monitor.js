require('dotenv').config();
const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const CHAT_ID = process.env.JULIAN_TELEGRAM_CHAT_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

// DEEP MULTI-PLATFORM RESEARCH
async function checkTempelhofNews() {
  console.log('🔍 Starting 5-MIN DEEP RESEARCH across all platforms...');

  const memory = loadMemory();
  if (!memory) return;

  const today = new Date().toISOString().split('T')[0];
  const startTime = Date.now();

  try {
    const allFindings = [];

    // 1. NEWS ARTICLES (Exa)
    console.log('📰 Phase 1: News articles...');
    const newsResults = await searchExa('Tempelhofer Feld Berlin Bebauung', 2);
    if (newsResults.length > 0) {
      for (let i = 0; i < Math.min(2, newsResults.length); i++) {
        const content = await readArticle(newsResults[i].url);
        if (content) {
          allFindings.push({
            source: 'NEWS',
            title: newsResults[i].title,
            url: newsResults[i].url,
            content: content.substring(0, 2000)
          });
        }
      }
    }

    // 2. REDDIT DISCUSSIONS
    console.log('💬 Phase 2: Reddit discussions...');
    const redditResults = await searchExa('Tempelhofer Feld site:reddit.com', 2);
    if (redditResults.length > 0) {
      for (let r of redditResults.slice(0, 2)) {
        const content = await readArticle(r.url);
        if (content) {
          allFindings.push({
            source: 'REDDIT',
            title: r.title,
            url: r.url,
            content: content.substring(0, 1500)
          });
        }
      }
    }

    // 3. TWITTER/X DISCUSSIONS
    console.log('🐦 Phase 3: Twitter discussions...');
    const twitterResults = await searchExa('Tempelhofer Feld site:twitter.com OR site:x.com', 1);
    if (twitterResults.length > 0) {
      allFindings.push({
        source: 'TWITTER',
        title: twitterResults[0].title,
        url: twitterResults[0].url,
        content: twitterResults[0].title
      });
    }

    // 4. COMMUNITY FORUMS
    console.log('🗣️ Phase 4: Community forums...');
    const forumResults = await searchExa('Tempelhofer Feld Diskussion Meinung', 1);
    if (forumResults.length > 0) {
      const content = await readArticle(forumResults[0].url);
      if (content) {
        allFindings.push({
          source: 'FORUM',
          title: forumResults[0].title,
          url: forumResults[0].url,
          content: content.substring(0, 1500)
        });
      }
    }

    console.log(`✅ Research complete: ${allFindings.length} sources in ${Math.round((Date.now() - startTime) / 1000)}s`);

    if (allFindings.length === 0) {
      console.log('No new content found');
      if (!memory.monitoring) memory.monitoring = {};
      if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
      memory.monitoring.tempelhof.last_check = today;
      saveMemory(memory);
      return;
    }

    // 5. AI STRATEGIC ANALYSIS FÜR AGENTUR
    console.log('🧠 Generating strategic analysis for agency...');
    const researchData = allFindings.map(f => `[${f.source}] ${f.title}\n${f.content}`).join('\n\n---\n\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Du bist Stratege für Julians Marketing-Agentur (JH Media). Er managed das Tempelhof-Projekt (€3.500).

RESEARCH DATA:
${researchData}

AUFGABE:
1. **ZUSAMMENFASSUNG** (3-4 Sätze): Was ist passiert?
2. **STRATEGISCHE INSIGHTS** (2-3 Punkte): Was bedeutet das für das Projekt?
3. **KREATIVE IDEEN** (3 konkrete Vorschläge):
   - Instagram Post-Ideen
   - Kampagnen-Konzepte
   - Starke Texte/Zitate die man nutzen kann
4. **HANDLUNGSEMPFEHLUNG**: Was sollte Julian JETZT tun?

FORMAT: Deutsch, direkt, kurz, umsetzbar. Keine Floskeln.`
        }]
      })
    });

    const analysis = await response.json();
    const strategicReport = analysis.content[0].text;

    // 6. SEND COMPREHENSIVE REPORT
    const sourceList = allFindings.map((f, i) => `${i + 1}. [${f.source}] ${f.title.substring(0, 60)}...`).join('\n');

    const message = `🏗️ *TEMPELHOF INTELLIGENCE REPORT*

📅 ${today} | ${allFindings.length} Quellen analysiert

${strategicReport}

📚 *Quellen:*
${sourceList}

🔗 Top-Link: ${allFindings[0].url}`;

    await sendTelegramMessage(message);

    // 7. UPDATE MEMORY
    if (!memory.monitoring) memory.monitoring = {};
    if (!memory.monitoring.tempelhof) memory.monitoring.tempelhof = {};
    memory.monitoring.tempelhof.last_check = today;
    memory.monitoring.tempelhof.latest_research = {
      date: today,
      sources_analyzed: allFindings.length,
      duration_seconds: Math.round((Date.now() - startTime) / 1000)
    };
    saveMemory(memory);

    console.log('✅ Strategic report sent!');

  } catch (err) {
    console.error('❌ Research failed:', err);
    await sendTelegramMessage(`⚠️ Research fehlgeschlagen: ${err.message}`);
  }
}

// Täglich um 9:00 Uhr
cron.schedule('0 9 * * *', () => {
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

console.log('✅ Tempelhof monitoring scheduler started (9:00 Berlin time daily)');
console.log('💡 CHAT_ID configured:', !!CHAT_ID);

module.exports = { checkTempelhofNews };
