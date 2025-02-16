require('dotenv').config();
const { Telegraf } = require('telegraf');
const twilio = require('twilio');
const express = require('express');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const app = express();
app.use(express.urlencoded({ extended: true }));

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
    const twiml = new twilio.twiml.VoiceResponse();

    // Keep the call active for longer
    twiml.pause({ length: 3 }); // Wait before speaking
    twiml.say("Hello! This is an automated call from your Telegram bot.");
    
    // Loop the message to keep the call open
    twiml.say("Stay on the line, press any key to continue.").pause({ length: 5 });
    
    // Keep call active indefinitely with a loop
    twiml.say("I will stay on the call for a while. Press any key when you are ready.");
    twiml.pause({ length: 10 });
    twiml.redirect(`${process.env.WEBHOOK_URL}/twiml?user_id=${userId}`); // Loop back to itself

    res.type('text/xml').send(twiml.toString());
});

// Capture DTMF (Keypad Presses)
app.post('/gather', (req, res) => {
    const userId = req.query.user_id;
    const digits = req.body.Digits;

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

// Start Telegram bot
bot.launch();
