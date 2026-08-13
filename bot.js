const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
let targetGroupId = ""; 
const phoneNumber = "917479893675"; 

let lastJobLink = "";

async function checkJharkhandJobs(sock) {
    if (!targetGroupId) return; 

    try {
        // Aapki research ki hui nayi website!
        const targetUrl = 'https://jharkhandijobs.com/all_pages/AllJharkhandJobs.aspx';
        const { data } = await axios.get(targetUrl);
        const $ = cheerio.load(data);
        
        let jobLinks = [];
        
        // Website ke andar se sabhi zaroori links nikalna
        $('a').each((i, el) => {
            let href = $(el).attr('href');
            let text = $(el).text().trim();
            
            // Faltu links (jaise Home, Contact) ko ignore karna
            if (href && text.length > 10 && !href.startsWith('javascript') && !href.startsWith('#')) {
                // Agar link aadhi-adhuri hai, toh usko poora banana
                if (href.startsWith('/')) {
                    href = 'https://jharkhandijobs.com' + href;
                } else if (!href.startsWith('http')) {
                    href = 'https://jharkhandijobs.com/all_pages/' + href;
                }
                jobLinks.push({ title: text, link: href });
            }
        });

        if (jobLinks.length === 0) return;

        // Sabse pehli aur nayi bharti/update ko pakadna
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
            console.log('✅ WhatsApp Bot Connected to JharkhandiJobs!');
            // Har 10 minute mein aapki website check karega
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
