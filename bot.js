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

// Track user's link generation
const userLinkGeneration = {}; // Structure: { userId: { count, resetDate } }

// Function: Create a unique invite link for the channel
const createInviteLink = async (channelId) => {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TOKEN}/createChatInviteLink`, {
      chat_id: channelId,
      expire_date: Math.floor(Date.now() / 1000) + 300,  // Link expires in 5 minutes
      member_limit: 1  // One user per invite link
    });
    return response.data.result.invite_link;
  } catch (error) {
    console.error(`⚠️ Error creating invite link: ${error.message}`);
    return null;
  }
};

// Function: Revoke an invite link for the specified channel
const revokeInviteLink = async (channelId, inviteLink) => {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/revokeChatInviteLink`, {
      chat_id: channelId,
      invite_link: inviteLink
    });
  } catch (error) {
    console.error(`⚠️ Error revoking invite link: ${error.message}`);
  }
};

// Function: Revoke all active invite links
const revokeAllInviteLinks = async () => {
  for (const { channelId, inviteLink } of Object.values(activeLinks)) {
    await revokeInviteLink(channelId, inviteLink);
  }
};

// Function: Reset user link generation count daily
const resetUserLinkGeneration = () => {
  const today = moment().startOf('day').toDate();
  for (const userId in userLinkGeneration) {
    if (userLinkGeneration[userId].resetDate < today) {
      userLinkGeneration[userId] = { count: 0, resetDate: today };
    }
  }
};

// Admin check function
const isAdmin = (userId) => ADMIN_IDS.includes(userId);

// Function to handle user's request within a section and offer more links
const handleChannelRequest = async (msg, sectionName) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let sectionChannels = SECTIONS[sectionName];

  if (!sectionChannels) {
    return bot.sendMessage(chatId, '❌ <b>Oops! Invalid section name!</b> Please try again. 🌟', { parse_mode: 'HTML' });
  }

  let channelList = 
`✨ <b><u>Select a Channel from ${sectionName}</u></b> ✨
📋 <i>Pick one from the options below:</i>\n`;

  sectionChannels.forEach((channel) => {
    channelList += `🔹 <code>${channel.name}</code>\n`;
  });

  bot.sendMessage(chatId, channelList, { parse_mode: 'HTML' });

  // Save state to handle multiple requests
  bot.once('message', async (response) => {
    const selectedChannel = sectionChannels.find(channel => channel.name.toLowerCase().includes(response.text.toLowerCase()));
    if (selectedChannel) {
      const inviteLink = await createInviteLink(selectedChannel.id);
      if (inviteLink) {
        activeLinks[chatId] = { channelId: selectedChannel.id, inviteLink };

        // Send the generated link message
        const linkMessage = `🔗 <b>Your exclusive invite link:</b> <code>${inviteLink}</code>
⏳ <i>This link expires in <b>5 minutes</b>, so join quickly before it’s too late!</i>`;

        const linkMessageSent = await bot.sendMessage(chatId, linkMessage, { parse_mode: 'HTML' });

        // Send the further link generation message in a separate message
        const furtherLinkMessage = `💡 Want more links? Click "Yes" below to get more links or "No" to end the session. 💡`;

        const furtherLinkMessageSent = await bot.sendMessage(chatId, furtherLinkMessage, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Yes', callback_data: 'more_links' }],
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
          bot.sendMessage(chatId, `⏳ <b>The invite link for <code>${selectedChannel.name}</code> has expired! 🕓</b>`, { parse_mode: 'HTML' });
          delete activeLinks[chatId];
        }, 300000);  // 5 minutes

        // Handle callback queries for generating more links or ending the session
        bot.on('callback_query', async (callbackQuery) => {
          const chatId = callbackQuery.message.chat.id;
          const data = callbackQuery.data;

          // Delete the message with further link options
          await bot.deleteMessage(chatId, messageId);

          if (data === 'more_links') {
            // Check if the user has reached their daily limit
            if (!isAdmin(callbackQuery.from.id)) {
              const userGeneration = userLinkGeneration[callbackQuery.from.id] || { count: 0, resetDate: moment().startOf('day').toDate() };

              if (userGeneration.resetDate < moment().startOf('day').toDate()) {
                userGeneration.count = 0;
                userGeneration.resetDate = moment().startOf('day').toDate();
              }

              if (userGeneration.count >= 7) {
                bot.sendMessage(chatId, '⚠️ <b>You have reached your daily link generation limit!</b> Please try again tomorrow.', { parse_mode: 'HTML' });
                return;
              }

              userGeneration.count++;
              userLinkGeneration[callbackQuery.from.id] = userGeneration;
            }

            // Ask the user to select a channel again
            bot.sendMessage(chatId, `🌀 <b>Select a Channel from ${sectionName}</b>`, { parse_mode: 'HTML' });

            // Save state to handle multiple requests
            bot.once('message', async (response) => {
              const selectedChannel = sectionChannels.find(channel => channel.name.toLowerCase().includes(response.text.toLowerCase()));
              if (selectedChannel) {
                const inviteLink = await createInviteLink(selectedChannel.id);
                if (inviteLink) {
                  activeLinks[chatId] = { channelId: selectedChannel.id, inviteLink };

                  const linkMessage = `🔗 <b>Your exclusive invite link:</b> <code>${inviteLink}</code>
⏳ <i>This link expires in <b>5 minutes</b>, so join quickly before it’s too late!</i>`;

                  await bot.sendMessage(chatId, linkMessage, { parse_mode: 'HTML' });

                  const furtherLinkMessage = `💡 Want more links? Click "Yes" below to get more links or "No" to end the session. 💡`;

                  const furtherLinkMessageSent = await bot.sendMessage(chatId, furtherLinkMessage, {
                    parse_mode: 'HTML',
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: 'Yes', callback_data: 'more_links' }],
                        [{ text: 'No', callback_data: 'end_session' }]
                      ]
                    }
                  });

                  const furtherLinkMessageId = furtherLinkMessageSent.message_id;

                  setTimeout(async () => {
                    await revokeInviteLink(selectedChannel.id, inviteLink);
                    bot.sendMessage(chatId, `⏳ <b>The invite link for <code>${selectedChannel.name}</code> has expired! 🕓</b>`, { parse_mode: 'HTML' });
                    delete activeLinks[chatId];
                  }, 300000);  // 5 minutes

                }
              }
            });

          } else if (data === 'end_session') {
            bot.sendMessage(chatId, 'Thank you for using the bot. Have a great day! 🌟');
            delete activeLinks[chatId];
          }
        });
      }
    }
  });
};

// Start command handler
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isAdmin(userId)) {
    bot.sendMessage(chatId, `Welcome Admin! You can manage the bot and access all features.`);
  } else {
    bot.sendMessage(chatId, `Welcome! You can generate invite links and use the bot.`);
  }
});

// /tlink command handler
bot.onText(/\/tlink/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) {
    const userGeneration = userLinkGeneration[userId] || { count: 0, resetDate: moment().startOf('day').toDate() };

    // Reset the daily limit if a new day has started
    if (userGeneration.resetDate < moment().startOf('day').toDate()) {
      userGeneration.count = 0;
      userGeneration.resetDate = moment().startOf('day').toDate();
    }

    if (userGeneration.count >= 7) {
      return bot.sendMessage(chatId, '⚠️ <b>You have reached your daily link generation limit!</b> Please try again tomorrow.', { parse_mode: 'HTML' });
    }

    userGeneration.count++;
    userLinkGeneration[userId] = userGeneration;
  }

  bot.sendMessage(chatId, `Please choose a section: \n${Object.keys(SECTIONS).join('\n')}`);
  bot.once('message', (response) => {
    const sectionName = response.text;
    handleChannelRequest(msg, sectionName);
  });
});

// /resetlimit command handler (Admin only)
bot.onText(/\/resetlimit/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isAdmin(userId)) {
    const targetUserId = parseInt(msg.text.split(' ')[1]);

    if (targetUserId && userLinkGeneration[targetUserId]) {
      userLinkGeneration[targetUserId] = { count: 0, resetDate: moment().startOf('day').toDate() };
      bot.sendMessage(chatId, `✅ <b>Reset the link generation limit for user ID ${targetUserId}!</b>`, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, '❌ <b>Invalid user ID!</b> Please provide a valid user ID.', { parse_mode: 'HTML' });
    }
  } else {
    bot.sendMessage(chatId, '❌ <b>You are not authorized to use this command!</b>', { parse_mode: 'HTML' });
  }
});

// /broadcast command handler (Admin only)
bot.onText(/\/broadcast/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isAdmin(userId)) {
    const broadcastMessage = msg.text.split(' ').slice(1).join(' ');
    if (broadcastMessage) {
      // You can customize this to send messages to specific chats or groups
      // Example: broadcast to all users or groups where the bot is added
      bot.sendMessage(chatId, `✅ <b>Broadcasting message:</b>\n${broadcastMessage}`, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, '❌ <b>Message content is missing!</b> Please provide a message to broadcast.', { parse_mode: 'HTML' });
    }
  } else {
    bot.sendMessage(chatId, '❌ <b>You are not authorized to use this command!</b>', { parse_mode: 'HTML' });
  }
});

// /stats command handler (Admin only)
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isAdmin(userId)) {
    const totalUsers = usedUsers.size;
    const totalLinks = Object.keys(activeLinks).length;
    const totalChannels = Object.values(SECTIONS).reduce((acc, channels) => acc + channels.length, 0);

    bot.sendMessage(chatId, `📊 <b>Bot Statistics:</b>\n\n🧑‍🤝‍🧑 <b>Total Users:</b> ${totalUsers}\n🔗 <b>Total Active Links:</b> ${totalLinks}\n📚 <b>Total Channels:</b> ${totalChannels}`, { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, '❌ <b>You are not authorized to use this command!</b>', { parse_mode: 'HTML' });
  }
});

// /revokeall command handler (Admin only)
bot.onText(/\/revokeall/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isAdmin(userId)) {
    await revokeAllInviteLinks();
    bot.sendMessage(chatId, '✅ <b>All active invite links have been revoked!</b>', { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, '❌ <b>You are not authorized to use this command!</b>', { parse_mode: 'HTML' });
  }
});

// Handle link generation limits at the start of the day
resetUserLinkGeneration();

// Log when the bot starts
console.log('✨ Ultra-stylish Telegram bot with broadcasting and admin features is now live! 🚀');
