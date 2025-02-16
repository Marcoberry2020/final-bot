require('dotenv').config();
const { Telegraf } = require('telegraf');
const twilio = require('twilio');
const express = require('express');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Ensure Express can parse Twilio's JSON payload

// Handle /call command
bot.command('call', async (ctx) => {
    const messageText = ctx.message.text;
    const phoneNumber = messageText.split(" ")[1]; // Extract number

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
        return ctx.reply("❌ Please provide a valid phone number. Example: /call +123456789");
    }

    try {
        const call = await client.calls.create({
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            url: `${process.env.WEBHOOK_URL}/twiml?user_id=${ctx.from.id}`, // Webhook for call instructions
            timeout: 120, // Increased timeout to 120 seconds
        });

        ctx.reply(`📞 Calling ${phoneNumber}...`);
    } catch (error) {
        console.error("❌ Twilio Error:", error);

        let errorMessage = "❌ Failed to make the call.";
        if (error.code) {
            errorMessage += `\nError Code: ${error.code}`;
        }
        if (error.message) {
            errorMessage += `\nMessage: ${error.message}`;
        }

        ctx.reply(errorMessage);
    }
});

// Handle Twilio Webhook for call instructions
app.post('/twiml', (req, res) => {
    const userId = req.query.user_id;
    console.log(`📞 Incoming call for user ${userId}`);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Hello! This is an automated call from your Telegram bot.");
    
    twiml.gather({
        numDigits: 1,
        action: `${process.env.WEBHOOK_URL}/gather?user_id=${userId}`,
        method: 'POST',
    }).say("Press any key to send back to Telegram.");

    res.type('text/xml').send(twiml.toString());
});

// Capture DTMF (Keypad Presses)
app.post('/gather', (req, res) => {
    const userId = req.query.user_id;
    const digits = req.body.Digits;

    console.log(`🔢 User ${userId} pressed: ${digits}`);

    if (userId) {
        bot.telegram.sendMessage(userId, `✅ User pressed: ${digits}`);
    }

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Thank you! Goodbye.");
    res.type('text/xml').send(twiml.toString());
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Handle graceful bot shutdown
process.once('SIGINT', () => {
    console.log("⚠️ Stopping bot...");
    bot.stop("SIGINT");
});
process.once('SIGTERM', () => {
    console.log("⚠️ Stopping bot...");
    bot.stop("SIGTERM");
});

// Start Telegram bot
bot.launch().then(() => console.log("🤖 Bot started successfully!"));
