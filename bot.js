const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const moment = require('moment');
require('dotenv').config();

// Telegram Bot Token
const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// Create an Express app
const app = express();
app.use(bodyParser.json());

// Set up a route for the webhook
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Set the webhook for the Telegram bot
const setWebhook = async () => {
  try {
    await bot.setWebHook('https://link-bot-by-trigo.onrender.com/webhook');
    console.log('Webhook set!');
  } catch (error) {
    console.error('Error setting webhook:', error);
  }
};
setWebhook();

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Admin user IDs
const ADMIN_IDS = [6020805369, 6013132170]; // Replace with actual admin IDs

// Sections with channels
const SECTIONS = {
  'Alien Test Series': [
    { name: 'Alien NEET Test Series', id: '-1002224862570' },
    { name: 'Alien Nurture 11th', id: '-1002216495058' },
    { name: 'Alien JEE Test Series', id: '-1002024377118' },
    { name: 'Alien Chapter Wise Test', id: '-1001995980597' },
  ],
  'PW Test Series': [
    { name: 'PW AITS Test', id: '-1002068523195' },
    { name: 'MIP Test Series', id: '-1002197193723' },
    { name: 'Lakshya NEET Tests', id: '-1002088979826' },
    { name: 'Arjuna NEET Tests', id: '-1002087786928' },
    { name: 'Yakeen NEET Tests', id: '-1002093330892' },
  ],
  'Other Institute Tests': [
    { name: 'NEET KAKA JEE', id: '-1002228026902' },
    { name: 'NEET KAKA GSB', id: '-1001890104575' },
    { name: 'NNTS NEET KAKA JEE', id: '-1002072452401' },
    { name: 'Aakash Test Series', id: '-1002039007496' },
    { name: 'Newlight Test Series', id: '-1002234111514' },
    { name: 'CLC Test Series', id: '-1002157233091' },
    { name: 'Memoneet Test Series', id: '-1002248481833' },
    { name: 'NEET PREP Tests', id: '-1002031105605' },
    { name: 'NYTS Test Series', id: '-1002203041240' },
    { name: 'Manthan Test Series', id: '-1002162784672' }
  ],
  'Lectures Channels': [
    { name: 'Lakshya NEET 1.0 2025', id: '-1002075382372' },
    { name: 'Lakshya NEET 3.0 2025', id: '-1002186935804' },
    { name: 'Anand Mani MBBS Lectures', id: '-1002153754909' },
  ]
};

// Store active invite links and users who used the bot
let activeLinks = {}; // Structure: { chatId: { channelId, inviteLink } }
const usedUsers = new Set(); // To track users who used the bot
let userLinkGeneration = {}; // Structure: { userId: { count, resetDate } }

// Admin check function
const isAdmin = (userId) => ADMIN_IDS.includes(userId);

// Create a unique invite link for the channel
const createInviteLink = async (channelId) => {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TOKEN}/createChatInviteLink`, {
      chat_id: channelId,
      expire_date: Math.floor(Date.now() / 1000) + 300, // Link expires in 5 minutes
      member_limit: 1
    });
    return response.data.result.invite_link;
  } catch (error) {
    console.error(`Error creating invite link: ${error.message}`);
    return null;
  }
};

// Revoke an invite link for the specified channel
const revokeInviteLink = async (channelId, inviteLink) => {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/revokeChatInviteLink`, {
      chat_id: channelId,
      invite_link: inviteLink
    });
  } catch (error) {
    console.error(`Error revoking invite link: ${error.message}`);
  }
};

// Revoke all active invite links
const revokeAllInviteLinks = async () => {
  for (const { channelId, inviteLink } of Object.values(activeLinks)) {
    await revokeInviteLink(channelId, inviteLink);
  }
};

// Show section options to the user
const showSectionOptions = async (chatId) => {
  const sectionOptions = Object.keys(SECTIONS).map(section => `- ${section}`).join('\n');
  bot.sendMessage(chatId, `📋 <b>Select a section to generate links:</b>\n${sectionOptions}`, { parse_mode: 'HTML' });
};

// Handle user’s request within a section and offer more links
const handleChannelRequest = async (msg, sectionName) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let sectionChannels = SECTIONS[sectionName];

  if (!sectionChannels) {
    return bot.sendMessage(chatId, '❌ <b>Invalid section name! Please try again.</b>', { parse_mode: 'HTML' });
  }

  let channelList = `✨ <b><u>Select a Channel from ${sectionName}</u></b> ✨\n📋 <i>Pick one from the options below:</i>\n`;

  sectionChannels.forEach((channel) => {
    channelList += `🔹 <code>${channel.name}</code>\n`;
  });

  bot.sendMessage(chatId, channelList, { parse_mode: 'HTML' });

  // Save state to handle multiple requests
  bot.once('message', async (response) => {
    const selectedChannel = sectionChannels.find(channel => channel.name.toLowerCase().includes(response.text.toLowerCase()));
    if (selectedChannel) {
      // Check if the user has reached their daily limit
      if (!isAdmin(userId)) {
        const userGeneration = userLinkGeneration[userId] || { count: 0, resetDate: moment().startOf('day').toDate() };
        if (moment().isAfter(userGeneration.resetDate)) {
          userGeneration.count = 0;
          userGeneration.resetDate = moment().startOf('day').toDate();
        }

        if (userGeneration.count >= 7) {
          return bot.sendMessage(chatId, '❌ <b>You have reached your daily limit of 7 links. Please try again tomorrow.</b>', { parse_mode: 'HTML' });
        }

        // Update user link generation data
        userGeneration.count++;
        userLinkGeneration[userId] = userGeneration;
      }

      const inviteLink = await createInviteLink(selectedChannel.id);
      if (inviteLink) {
        activeLinks[chatId] = { channelId: selectedChannel.id, inviteLink };

        // Send the generated link message
        const linkMessage = `🔗 <b>Your exclusive invite link:</b> <code>${inviteLink}</code>\n⏳ <i>This link expires in <b>5 minutes</b>, so join quickly before it’s too late!</i>`;

        const linkMessageSent = await bot.sendMessage(chatId, linkMessage, { parse_mode: 'HTML' });

        // Send further link generation message in a separate message
        const furtherLinkMessage = `💡 Want more links? Click "Yes" below to get more links or "No" to end the session. 💡`;

        const furtherLinkMessageSent = await bot.sendMessage(chatId, furtherLinkMessage, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Yes', callback_data: `more_links_${sectionName}` }],
              [{ text: 'No', callback_data: 'end_session' }]
            ]
          }
        });

        // Store message IDs to delete later
        const messageId = furtherLinkMessageSent.message_id;
        const linkMessageId = linkMessageSent.message_id;

        // Revoke the invite link after 5 minutes
        setTimeout(async () => {
          await revokeInviteLink(selectedChannel.id, inviteLink);
          bot.sendMessage(chatId, `⏳ <b>The invite link for <code>${selectedChannel.name}</code> has expired!</b>`, { parse_mode: 'HTML' });
          delete activeLinks[chatId];
        }, 300000); // 5 minutes
      } else {
        bot.sendMessage(chatId, '❌ <b>Failed to generate the invite link. Please try again later.</b>', { parse_mode: 'HTML' });
      }
    } else {
      bot.sendMessage(chatId, '❌ <b>Invalid channel selected! Please try again.</b>', { parse_mode: 'HTML' });
    }
  });
};

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const userId = callbackQuery.from.id;
  const chatId = message.chat.id;

  if (data.startsWith('more_links_')) {
    const section = data.split('_').slice(1).join('_');

    if (!isAdmin(userId)) {
      const userGeneration = userLinkGeneration[userId] || { count: 0, resetDate: moment().startOf('day').toDate() };
      if (moment().isAfter(userGeneration.resetDate)) {
        userGeneration.count = 0;
        userGeneration.resetDate = moment().startOf('day').toDate();
      }

      if (userGeneration.count >= 7) {
        return bot.sendMessage(chatId, '❌ <b>You have reached your daily limit of 7 links. Please try again tomorrow.</b>', { parse_mode: 'HTML' });
      }

      // Update user link generation data
      userGeneration.count++;
      userLinkGeneration[callbackQuery.from.id] = userGeneration;
    }

    // Generate more links from the same section
    await handleChannelRequest(message, section);
  } else if (data === 'end_session') {
    bot.sendMessage(chatId, '🛑 <b>Session ended. If you need more links, you can request them again.</b>', { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, '❌ <b>Unknown command. Please try again.</b>', { parse_mode: 'HTML' });
  }
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!usedUsers.has(userId)) {
    usedUsers.add(userId);
    showSectionOptions(chatId);
  } else {
    bot.sendMessage(chatId, '👋 <b>Welcome back! You can request links again.</b>', { parse_mode: 'HTML' });
  }
});

// Handle /broadcast command
bot.onText(/\/broadcast/, async (msg) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ <b>Only admins can use this command.</b>', { parse_mode: 'HTML' });

  const broadcastMessage = '📢 <b>Broadcast message content here.</b>'; // Replace with actual broadcast message
  const chatIds = [/* List of chat IDs */]; // Add chat IDs to broadcast the message

  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, broadcastMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`Error broadcasting message to ${chatId}: ${error.message}`);
    }
  }

  bot.sendMessage(msg.chat.id, '✅ <b>Broadcast message sent to all chats.</b>', { parse_mode: 'HTML' });
});

// Handle /revokeall command
bot.onText(/\/revokeall/, async (msg) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ <b>Only admins can use this command.</b>', { parse_mode: 'HTML' });

  await revokeAllInviteLinks();
  bot.sendMessage(msg.chat.id, '✅ <b>All active invite links have been revoked.</b>', { parse_mode: 'HTML' });
});

// Handle /resetlimit command
bot.onText(/\/resetlimit (.+)/, (msg, match) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ <b>Only admins can use this command.</b>', { parse_mode: 'HTML' });

  const userId = parseInt(match[1], 10);
  if (!userLinkGeneration[userId]) return bot.sendMessage(msg.chat.id, '❌ <b>No limit data found for this user.</b>', { parse_mode: 'HTML' });

  userLinkGeneration[userId].count = 0;
  bot.sendMessage(msg.chat.id, '✅ <b>The link generation limit for the specified user has been reset.</b>', { parse_mode: 'HTML' });
});

// Handle /stats command
bot.onText(/\/stats/, (msg) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ <b>Only admins can use this command.</b>', { parse_mode: 'HTML' });

  const totalUsers = usedUsers.size;
  const activeLinksCount = Object.keys(activeLinks).length;
  const totalChannels = Object.keys(SECTIONS).length;

  const statsMessage = `📊 <b>Bot Statistics:</b>\n\n` +
    `👥 <b>Total Users:</b> ${totalUsers}\n` +
    `🔗 <b>Active Invite Links:</b> ${activeLinksCount}\n` +
    `📚 <b>Total Channels:</b> ${totalChannels}`;

  bot.sendMessage(msg.chat.id, statsMessage, { parse_mode: 'HTML' });
});


// Log when the bot starts
console.log('✨ Ultra-stylish Telegram bot with broadcasting and admin features is now live! 🚀');
