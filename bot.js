const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
let lastJobLink = "";
let targetGroupId = ""; 

// Aapka number country code (91) ke sath bina kisi space ya '+' ke
const phoneNumber = "917479893675"; 

async function autoCheckAndExtract(sock) {
    if (!targetGroupId) return; 

    try {
        const { data } = await axios.get('https://www.sarkariresult.com/');
        const $ = cheerio.load(data);
        
        let latestLink = $('#post a').first().attr('href');
        if (!latestLink) return;
        if (!latestLink.startsWith('http')) latestLink = 'https://www.sarkariresult.com' + latestLink;

        if (latestLink === lastJobLink) return; 

        console.log("🚨 Nayi Vacancy Mil Gayi! Details nikal raha hu...");
        lastJobLink = latestLink; 

        const { data: jobPage } = await axios.get(latestLink);
        const $$ = cheerio.load(jobPage);

        const jobTitle = $$('h1').first().text().trim() || "Nayi Sarkari Bharti";
        let shortInfo = $$('span:contains("Short Information")').parent().text().replace('Short Information :', '').trim();
        if (shortInfo && shortInfo.length > 250) shortInfo = shortInfo.substring(0, 250) + "...";

        const dukanWalaMessage = `
🚨 *NAYI BUMPER BHARTI (VACANCY)* 🚨

💼 *Post Ka Naam:* 
📌 ${jobTitle}

📝 *Thodi Jankari:* 
${shortInfo ? shortInfo : 'Sarkari vibhag mein nayi bharti ka notification aa gaya hai.'}

🗓️ *Zaroori Tareekhein (Dates):*
✔️ Form Shuru: Notification jari ho chuka hai
✔️ Aakhiri Tareekh: *Server down hone se pehle bharein!*

💰 *Fees & Umar (Age):*
✔️ General/OBC aur SC/ST ke hisaab se chhoot hai.
✔️ Umar (Age Limit) post ke anusaar alag-alag hai.

👨‍🎓 *Kaun Bhar Sakta Hai:*
✔️ 10th / 12th / ITI / Graduation paas ummeedwaron ke liye sunehra mauka!

📍 *Sahi Aur Bina Galti Form Bharwane Ke Liye Aayein:* 
*Apni Dukan Par, Main Road Chiniya (Garhwa)*

📞 *Sampark Karein:* 7479893675

*(Poori detail, Fees aur Age ki pakki jankari ke liye seedha dukan par visit karein ya call karein)*

⏳ _Last date ka intezaar na karein, aaj hi sampark karein!_`;

        await sock.sendMessage(targetGroupId, { text: dukanWalaMessage });
        console.log("🚀 WhatsApp Group mein Auto-Update bhej diya gaya!");
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // QR Code ab nahi dikhega
        browser: ["Ubuntu", "Chrome", "20.0.04"] // Pairing code ke liye yeh hona zaroori hai
    });

    // Agar bot pehle se login nahi hai, toh Pairing Code generate karo
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
            setInterval(() => autoCheckAndExtract(sock), 180000); // 3 minutes loop
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text === '!startbot') {
            targetGroupId = msg.key.remoteJid;
            await sock.sendMessage(targetGroupId, { text: '✅ *SarkariResult Auto-Update Tracker On!* Ab jab bhi nayi job aayegi, main khud yahan bhej dunga.' });
            console.log("Target Group Set Ho Gaya:", targetGroupId);
        }
    });
}

connectToWhatsApp();

app.get('/', (req, res) => res.send("WhatsApp Bot is Alive! 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server chal raha hai`));
