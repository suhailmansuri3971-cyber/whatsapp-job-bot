const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const express = require('express');

const app = express();
let targetGroupId = ""; 
const phoneNumber = "917479893675"; 

async function fetchAndSendInternetData(sock) {
    if (!targetGroupId) return; 

    try {
        // Internet ki Open API se Live Data Fetch kar rahe hain (JSON format)
        const { data } = await axios.get('https://dummyjson.com/quotes/random');
        
        // Data aane par API se extract karna
        const nayaQuote = data.quote;
        const jisneLikha = data.author;

        // Message ka badiya sa structure
        const liveMessage = `
🌐 *LIVE INTERNET UPDATE* 🌐

📝 "${nayaQuote}"

👤 _- ${jisneLikha}_

━━━━━━━━━━━━━━━━━━━
✅ Data Extracted Successfully
⏳ (Agla update theek 1 minute baad)
`;

        await sock.sendMessage(targetGroupId, { text: liveMessage });
        console.log("🚀 Naya data internet se lakar Group mein bhej diya!");
    } catch (error) {
        console.log("❌ Error fetching live data:", error.message);
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.me?.id) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n🚨🚨 PAIRING CODE: ${code} 🚨🚨\n`);
            } catch(e) {}
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot Connected!');
            
            // Theek 1 minute (60,000 miliseconds) ka API Fetch Loop
            setInterval(() => fetchAndSendInternetData(sock), 60000); 
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text === '!startshayari') {
            targetGroupId = msg.key.remoteJid;
            await sock.sendMessage(targetGroupId, { text: '✅ *Internet Scraper On!* Ab har 1 minute mein live API data yahan aayega.' });
        }
    });
}

connectToWhatsApp();

app.get('/', (req, res) => res.send("Live Scraper Bot is Alive! 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server chal raha hai`));
