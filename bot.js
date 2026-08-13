const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
let targetGroupId = ""; 

// Aapka WhatsApp number (Country code ke sath)
const phoneNumber = "917479893675"; 

async function fetchAndSendShayari(sock) {
    if (!targetGroupId) return; // Agar group set nahi hai toh ruko

    try {
        // Internet se Shayari fetch karna (Yahan hum ek website scrape kar rahe hain)
        // Note: Hum multiple pages se random utha sakte hain, yahan ek simple page liya hai
        const { data } = await axios.get('https://www.shayarify.com/best-shayari/');
        const $ = cheerio.load(data);
        
        let shayariList = [];
        
        // Website par jahan bhi shayari likhi hai, usko list mein daalo
        $('.shayari-content p, .entry-content p').each((index, element) => {
            let text = $(element).text().trim();
            if (text.length > 20 && text.length < 300) { // Faltu text hatane ke liye
                shayariList.push(text);
            }
        });

        if (shayariList.length === 0) {
            console.log("Shayari nahi mili, agli baar try karenge.");
            return;
        }

        // List mein se koi ek random shayari chuno
        const randomIndex = Math.floor(Math.random() * shayariList.length);
        const randomShayari = shayariList[randomIndex];

        // Group mein bhejne ke liye badiya sa design
        const mastMessage = `
✨ *EK NAYI SHAYARI AAPKE LIYE* ✨

🌹 _${randomShayari}_ 🌹

━━━━━━━━━━━━━━━━━━━
✍️ *Aapka Apna Bot*
⏳ (Har minute nayi peshkash)
`;

        await sock.sendMessage(targetGroupId, { text: mastMessage });
        console.log("🚀 Shayari Group mein bhej di gayi!");
    } catch (error) {
        console.log("❌ Error fetching shayari:", error.message);
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
                console.log(`\n======================================================`);
                console.log(`🚨🚨 Kripya apne WhatsApp me ye PAIRING CODE dalein: ${code} 🚨🚨`);
                console.log(`======================================================\n`);
            } catch(e) {
                console.log("Pairing code error:", e);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot Connected!');
            
            // ⏰ TIME SETTING: 60000 = 1 Minute
            // Agar ban se bachna ho toh ise 1800000 (30 min) ya 3600000 (1 hour) kar lijiye
            setInterval(() => fetchAndSendShayari(sock), 60000); 
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // Naya command: !startshayari
        if (text === '!startshayari') {
            targetGroupId = msg.key.remoteJid;
            await sock.sendMessage(targetGroupId, { text: '✅ *Shayari Bot On!* Ab har minute yahan shayari aayegi.' });
            console.log("Target Group Set Ho Gaya:", targetGroupId);
        }
    });
}

connectToWhatsApp();

app.get('/', (req, res) => res.send("WhatsApp Shayari Bot is Alive! 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server chal raha hai`));
