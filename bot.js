const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
let targetGroupId = ""; 
// Aapka WhatsApp Number
const phoneNumber = "917479893675"; 

let lastJobLink = "";

async function checkJharkhandJobs(sock) {
    if (!targetGroupId) return; 

    try {
        const targetUrl = 'https://jharkhandijobs.com/all_pages/AllJharkhandJobs.aspx';
        
        // Anti-Blocker Mask (Taki website block na kare)
        const { data } = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        let jobLinks = [];
        
        // Links Extract Karna
        $('a').each((i, el) => {
            let href = $(el).attr('href');
            let text = $(el).text().trim();
            
            if (href && text.length > 10 && !href.startsWith('javascript') && !href.startsWith('#')) {
                if (href.startsWith('/')) {
                    href = 'https://jharkhandijobs.com' + href;
                } else if (!href.startsWith('http')) {
                    href = 'https://jharkhandijobs.com/all_pages/' + href;
                }
                jobLinks.push({ title: text, link: href });
            }
        });

        if (jobLinks.length === 0) return;

        let latestJob = jobLinks[0]; 

        if (latestJob.link === lastJobLink) return; 

        console.log("🚨 Nayi Jharkhand Vacancy Mil Gayi!");
        lastJobLink = latestJob.link; 

        const jobMessage = `
🚨 *JHARKHAND JOB UPDATE* 🚨

📌 *Update:* ${latestJob.title}
 
📄 *Puri Jankari Aur Vigyapan (Notification) Dekhein:* 
🔗 ${latestJob.link}
 
📍 *Form Bharwane, Result Dekhne Ya Print Nikalwane Aayein:*
*Main Road Chiniya (Garhwa)*
📞 *Sampark Karein:* 7479893675
 
⏳ _Last date ka intezaar na karein, samay par form bharein!_`;

        await sock.sendMessage(targetGroupId, { text: jobMessage });
    } catch (error) {
        console.log("❌ Scraping error:", error.message);
    }
}

async function connectToWhatsApp() {
    // 🔴 Badi Tabdeeli: Naya Session Name (Purana kachra saaf)
    const { state, saveCreds } = await useMultiFileAuthState('auth_session_jharkhand');
    
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
                console.log(`\n🚨🚨 NAYA PAIRING CODE: ${code} 🚨🚨\n`);
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
            console.log('✅ WhatsApp Bot Connected to JharkhandiJobs!');
            // Har 10 minute ka loop
            setInterval(() => checkJharkhandJobs(sock), 600000); 
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text === '!startbot') {
            targetGroupId = msg.key.remoteJid;
            await sock.sendMessage(targetGroupId, { text: '✅ *JharkhandiJobs Tracker On!* Ab saare updates yahan aayenge.' });
        }
    });
}

connectToWhatsApp();

app.get('/', (req, res) => res.send("Jharkhand Scraper is Alive! 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server chal raha hai`));
