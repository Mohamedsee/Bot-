// index.js - بوت واتساب بسيط يربط Baileys مع OpenAI
require('dotenv').config();
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@adiwajshing/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const axios = require('axios');
const moment = require('moment');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OWNER = process.env.BOT_OWNER || '';
const SESSION_DIR = process.env.SESSION_DIR || './auth_info';
const AI_ENABLED_DEFAULT = (process.env.AI_ENABLED || 'true') === 'true';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

const chatSettingsFile = './chat_settings.json';
let chatSettings = {};
if (fs.existsSync(chatSettingsFile)) chatSettings = fs.readJsonSync(chatSettingsFile);

async function saveSettings(){
  await fs.writeJson(chatSettingsFile, chatSettings, { spaces: 2 });
}

async function callOpenAI(system, userMessages){
  if(!OPENAI_KEY) return 'خطأ: مفتاح OpenAI غير مضبوط في متغيرات البيئة.';
  try{
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system || 'You are a helpful assistant.' },
        ...userMessages
      ],
      max_tokens: 800,
      temperature: 0.7
    };
    const res = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
    });
    const reply = res.data.choices && res.data.choices[0].message.content;
    return reply || 'لم أستطع توليد ردّ الآن.';
  }catch(err){
    console.error('OpenAI error', err?.response?.data || err.message);
    return 'حدث خطأ عند التواصل مع خدمة الذكاء الاصطناعي.';
  }
}

(async ()=>{
  await fs.ensureDir(SESSION_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr){
      qrcode.generate(qr, { small: true });
      console.log('امسح رمز QR من واتساب لتوصيل البوت');
    }
    if(connection === 'close'){
      const reason = (lastDisconnect || {}).error?.output?.statusCode;
      console.log('Connection closed, reason:', lastDisconnect?.error?.toString());
    }
    if(connection === 'open'){
      console.log('🔌 البوت متصل الآن');
    }
  });

  sock.ev.on('messages.upsert', async m => {
    try{
      const msg = m.messages[0];
      if(!msg || msg.key?.remoteJid === 'status@broadcast') return;
      if(msg.key.fromMe) return; // تجاهل الرسائل الصادرة من نفس الجلسة

      const jid = msg.key.remoteJid;
      const from = jid.split('@')[0];
      const pushname = msg.pushName || 'مستخدم';

      // نص الرسالة
      const text = (msg.message?.conversation) || (msg.message?.extendedTextMessage?.text) || '';
      console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${pushname} (${jid}): ${text}`);

      // إعدادات الدردشة افتراضيًا
      if(!chatSettings[jid]) chatSettings[jid] = { aiEnabled: AI_ENABLED_DEFAULT, welcome: '' };

      // أوامر الإدارة (تبدأ بشرطة مائلة)
      if(text.startsWith('/')){
        const parts = text.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        // فقط صاحب البوت يمكنه تنفيذ أوامر المدير
        if(cmd === '/help'){
          await sock.sendMessage(jid, { text: 'أوامر متاحة:\n/help - مساعدة\n/ai on - تفعيل AI للمحادثة\n/ai off - إيقاف AI للمحادثة\n/setwelcome <نص> - تعيين رسالة ترحيب\n/clearwelcome - حذف رسالة الترحيب' });
        }
        else if(cmd === '/ai'){
          if(from !== OWNER.replace('+','')){
            await sock.sendMessage(jid, { text: 'فشل: هذا الأمر مقصور على صاحب البوت.' });
          } else {
            if(arg === 'on') chatSettings[jid].aiEnabled = true;
            else if(arg === 'off') chatSettings[jid].aiEnabled = false;
            await saveSettings();
            await sock.sendMessage(jid, { text: `تم تعيين AI للمحادثة: ${chatSettings[jid].aiEnabled ? 'مفعل' : 'موقوف'}` });
          }
        }
        else if(cmd === '/setwelcome'){
          if(from !== OWNER.replace('+','')){
            await sock.sendMessage(jid, { text: 'فشل: هذا الأمر مقصور على صاحب البوت.' });
          } else {
            chatSettings[jid].welcome = arg;
            await saveSettings();
            await sock.sendMessage(jid, { text: 'تم تعيين رسالة الترحيب.' });
          }
        }
        else if(cmd === '/clearwelcome'){
          if(from !== OWNER.replace('+','')){
            await sock.sendMessage(jid, { text: 'فشل: هذا الأمر مقصور على صاحب البوت.' });
          } else {
            chatSettings[jid].welcome = '';
            await saveSettings();
            await sock.sendMessage(jid, { text: 'تم حذف رسالة الترحيب.' });
          }
        }
        return;
      }

      // إرسال ترحيب إذا معرّف
      if(chatSettings[jid].welcome && text.toLowerCase().includes('مرحبا')){
        await sock.sendMessage(jid, { text: chatSettings[jid].welcome });
        return;
      }

      // إذا AI مفعل في هذه المحادثة، استدعِ OpenAI
      if(chatSettings[jid].aiEnabled){
        // تكوين رسائل الإدخال للـ OpenAI
        const system = 'أنت مساعد ودود ومتجاوب، تحدث بالعربية عند الحاجة.';
        const userMessages = [{ role: 'user', content: text }];

        const reply = await callOpenAI(system, userMessages);
        await sock.sendMessage(jid, { text: reply });
        return;
      }

      // إن لم يكن AI مفعلًا، يمكن للبوت الرد برسالة افتراضية
      await sock.sendMessage(jid, { text: 'البوت جاهز — لكن AI موقوف في هذه المحادثة. اطلب /help للأوامر.' });

    }catch(e){
      console.error('processing message error', e);
    }
  });

})();