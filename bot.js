const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
let targetGroupId = ""; 
const phoneNumber = "917479893675"; 

// Pichli check ki hui links yaad rakhne ke liye
let lastJobLink = "";
let lastResultLink = "";

// Jharkhand Jobs check karne ka function
async function checkJharkhandJobs(sock) {
    if (!targetGroupId) return; 

    try {
        // Hum JharkhandJob ya FreeJobAlert jaisi sites se data nikalenge
        const { data } = await axios.get('https://jharkhandjob.in/category/jharkhand-job/');
        const $ = cheerio.load(data);
        
        let latestJobPost = $('.post-title a').first();
        let latestLink = latestJobPost.attr('href');
        let jobTitle = latestJobPost.text().trim();

        if (!latestLink || latestLink === lastJobLink) return; 

        console.log("🚨 Nayi Jharkhand Vacancy Mil Gayi!");
        lastJobLink = latestLink; 

        // Andar ke page se details nikalna (Demo structure)
        const jobPage = await axios.get(latestLink);
        const $$ = cheerio.load(jobPage.data);
        
        let officialPdfLink = $$('a:contains("Notification"), a:contains("Advertisement")').attr('href') || latestLink;

        const jobMessage = `
🚨 *JHARKHAND BUMPER BHARTI* 🚨

📌 *Vibhag/Post:* ${jobTitle}
👨‍🎓 *Yogyata (Eligibility):* Notification check karein
🗓️ *Zaroori Tareekhein:* Form shuru ho chuka hai
💰 *Form Fees & Umar:* Vibhag ke anusaar
 
📄 *Official Vigyapan (Notification) Dekhein:* 
🔗 ${officialPdfLink}
 
📍 *Sahi Aur Bina Galti Form Bharwane Ke Liye Aayein:*
*Apni Dukan Par, Main Road Chiniya (Garhwa)*
📞 *Sampark Karein:* 7479893675
 
⏳ _Last date ka intezaar na karein, aaj hi sampark karein!_`;

        await sock.sendMessage(targetGroupId, { text: jobMessage });
    } catch (error) {
        console.log("❌ Job scraping error:", error.message);
    }
}

// Jharkhand Results check karne ka function
async function checkJharkhandResults(sock) {
    if (!targetGroupId) return; 

    try {
        const { data } = await axios.get('https://jharkhandjob.in/category/result/');
        const $ = cheerio.load(data);
        
        let latestResultPost = $('.post-title a').first();
        let latestLink = latestResultPost.attr('href');
        let resultTitle = latestResultPost.text().trim();

        if (!latestLink || latestLink === lastResultLink) return; 

        console.log("🏆 Naya Jharkhand Result Mil Gaya!");
        lastResultLink = latestLink; 

        const resultPage = await axios.get(latestLink);
        const $$ = cheerio.load(resultPage.data);
        
        let resultDownloadLink = $$('a:contains("Result"), a:contains("Merit List"), a:contains("Answer Key")').attr('href') || latestLink;

        const resultMessage = `
🏆 *JHARKHAND RESULT / MERIT LIST DECLARED* 🏆

📌 *Exam Ka Naam:* ${resultTitle}
📝 *Update:* Result / Answer Key jari kar di gayi hai!
 
👇 *Apna Result Yahan Check Karein:*
🔗 ${resultDownloadLink}
 
📍 *Form bharne, Result dekhne ya Print nikalwane aayen:* 
*Main Road Chiniya (Garhwa)*
📞 *Sampark:* 7479893675`;

        await sock.sendMessage(targetGroupId, { text: resultMessage });
    } catch (error) {
        console.log("❌ Result scraping error:", error.message);
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
            
            // Har 10 minute mein ek baar Jobs aur Results check karega (Server par load nahi padega)
            setInterval(() => checkJharkhandJobs(sock), 600000); 
            setInterval(() => checkJharkhandResults(sock), 630000); // 30 second ka gap dono ke beech
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text === '!startbot') {
            targetGroupId = msg.key.remoteJid;
            await sock.sendMessage(targetGroupId, { text: '✅ *Jharkhand Auto-Tracker On!* Ab Garhwa, Palamu, JSSC aur JPSC ke updates seedha yahan aayenge.' });
        }
    });
}

connectToWhatsApp();

app.get('/', (req, res) => res.send("Jharkhand Scraper is Alive! 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server chal raha hai`));
