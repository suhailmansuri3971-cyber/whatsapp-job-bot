const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
let lastJobLink = "";
let targetGroupId = ""; // Yahan hum WhatsApp Group save karenge

async function autoCheckAndExtract(sock) {
    if (!targetGroupId) return; // Agar group set nahi hai toh ruko

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

        // Ekdum Insaan (Dukandaar) ki tarah likha hua message (Address aur Number ke sath)
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
        printQRInTerminal: true,
        browser: ["Mansuri Job Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("👇 APNA WHATSAPP KHOLO AUR YE QR CODE SCAN KARO 👇");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot Connected!');
            // Har 3 minute mein website check karega
            setInterval(() => autoCheckAndExtract(sock), 180000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Bot ko batane ke liye ki kis group mein message bhejna hai
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // Agar aap group mein "!startbot" likhenge, toh bot us group ko yaad kar lega
        if (text === '!startbot') {
            targetGroupId = msg.key.remoteJid;
            await sock.sendMessage(targetGroupId, { text: '✅ *SarkariResult Auto-Update Tracker On!* Ab jab bhi nayi job aayegi, main khud yahan bhej dunga.' });
            console.log("Target Group Set Ho Gaya:", targetGroupId);
        }
    });
}

connectToWhatsApp();

// Cloud Server ko jagaye rakhne ke liye
app.get('/', (req, res) => res.send("WhatsApp Bot is Alive! 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server chal raha hai`));
