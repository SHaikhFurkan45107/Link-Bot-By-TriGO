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

// Reset user link generation count daily
const resetUserLinkGeneration = () => {
  const today = moment().startOf('day').toDate();
  for (const userId in userLinkGeneration) {
    if (userLinkGeneration[userId].resetDate < today) {
      userLinkGeneration[userId] = { count: 0, resetDate: today };
    }
  }
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
          bot.sendMessage(chatId, `⏳ <b>The invite link for <code>${selectedChannel.name}</code> has expired!</b>`, { parse_mode: 'HTML' });
          delete activeLinks[chatId];
        }, 300000); // 5 minutes

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
              if (userGeneration.count >= 7) {
                return bot.sendMessage(chatId, '❌ <b>You have reached the daily limit of generating 7 links.</b> Please try again tomorrow.', { parse_mode: 'HTML' });
              }
              userGeneration.count += 1;
              userLinkGeneration[callbackQuery.from.id] = userGeneration;
            }

            // Handle channel request again for more links
            handleChannelRequest(callbackQuery.message, sectionName);
          } else if (data === 'end_session') {
            bot.sendMessage(chatId, '✅ <b>Session ended. If you need more links, please use the command again.</b>', { parse_mode: 'HTML' });
          }
        });
      } else {
        bot.sendMessage(chatId, '⚠️ <b>Sorry, there was an error generating the invite link. Please try again later.</b>', { parse_mode: 'HTML' });
      }
    } else {
      bot.sendMessage(chatId, '❌ <b>Invalid channel name selected. Please try again.</b>', { parse_mode: 'HTML' });
    }
  });
};

// Command: /tlink
bot.onText(/\/tlink/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Increment user usage count and store user ID
  if (!usedUsers.has(userId)) {
    userUsageCount++;
    usedUsers.add(userId);
  }

  // Reset user link generation count if needed
  resetUserLinkGeneration();

  // Check if the user is an admin
  if (!isAdmin(userId)) {
    // Check if the user has exceeded the daily limit
    const userGeneration = userLinkGeneration[userId] || { count: 0, resetDate: moment().startOf('day').toDate() };
    if (userGeneration.count >= 7) {
      return bot.sendMessage(chatId, '⚠️ <b>You’ve reached your daily limit of generating invite links.</b> 🚫 Please try again tomorrow! 🌅', { parse_mode: 'HTML' });
    }

    // Increment the user's link generation count
    userLinkGeneration[userId] = { count: userGeneration.count + 1, resetDate: userGeneration.resetDate };
  }

  // Build a formatted section list
  let sectionList = `
✨ <b><u>Select Your Section to Get an Invite Link</u></b> ✨
📋 <i>Pick one from the sections below:</i>\n`;

  Object.keys(SECTIONS).forEach((section) => {
    sectionList += `🔹 <code>${section}</code>\n`;
  });

  bot.sendMessage(chatId, sectionList, { parse_mode: 'HTML' });

  bot.once('message', async (response) => {
    const selectedSection = Object.keys(SECTIONS).find(section => section.toLowerCase() === response.text.toLowerCase());
    if (selectedSection) {
      handleChannelRequest(msg, selectedSection);
    } else {
      bot.sendMessage(chatId, '❌ <b>Invalid section name!</b> Please double-check and try again. 💬', { parse_mode: 'HTML' });
    }
  });
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error(`⚠️ Polling Error: ${error.message}`);
});

app.use(express.json());

app.post('/' + TOKEN, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Admin-only command: /stats
bot.onText(/\/stats/, async (msg) => {
  const adminId = msg.from.id;

  if (!isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, '🚫 <b>You are not authorized to use this command.</b>', { parse_mode: 'HTML' });
  }

  // Get total number of users who used the bot
  const totalUsers = usedUsers.size;

  // Get total number of active links
  const totalActiveLinks = Object.keys(activeLinks).length;

  // Get total number of sections (channels categories)
  const totalSections = Object.keys(SECTIONS).length;

  // Construct the status message
  const statusMessage = 
    `📊 <b>Bot Statistics:</b>
    👥 <b>Total users who used the bot:</b> ${totalUsers}
    🔗 <b>Total active invite links:</b> ${totalActiveLinks}
    📡 <b>Total sections (channels categories):</b> ${totalSections}`;

  bot.sendMessage(msg.chat.id, statusMessage, { parse_mode: 'HTML' });
});

// Admin-only command: /revokeall
bot.onText(/\/revokeall/, async (msg) => {
  const userId = msg.from.id;
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, '🚫 <b>You are not authorized to use this command.</b>', { parse_mode: 'HTML' });
  }

  // Revoke all active invite links
  await revokeAllInviteLinks();
  activeLinks = {};  // Clear the active links
  bot.sendMessage(msg.chat.id, '🔄 <b>All active invite links have been revoked.</b>', { parse_mode: 'HTML' });
});

// Admin-only command: /broadcast
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, '🚫 <b>You are not authorized to use this command.</b>', { parse_mode: 'HTML' });
  }

  const messageText = match[1];
  for (const user of usedUsers) {
    try {
      await bot.sendMessage(user, messageText, { parse_mode: 'HTML' });
    } catch (error) {
      if (error.response && error.response.statusCode === 403) {
        // If error code 403, it's possible the user has blocked the bot
        blockedUsers.add(user);
        console.log(`User ${user} has blocked the bot.`);
      } else {
        console.error(`Failed to broadcast message to user ${user}: ${error.message}`);
      }
    }
  }

  bot.sendMessage(msg.chat.id, '📣 <b>Broadcast message sent to all users.</b>', { parse_mode: 'HTML' });
});

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  const welcomeMessage = `
  👋 <b>Welcome, ${msg.from.first_name}!</b>
  🚀 <i>I'm here to help you generate invite links for various TeamTriGO's channels.</i>
  
  🔗 Your gateway to our exclusive channels! 🔗

Type /tlink to receive your personal invite link.

🚀 Pro tip: Don’t forget to join our backup at @URSTRIGO! 🌟
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

// Admin-only command: /resetlimit
bot.onText(/\/resetlimit (\d+)/, (msg, match) => {
  const adminId = msg.from.id;
  const targetUserId = parseInt(match[1]); // Extract the user ID to reset

  if (!isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, '🚫 <b>You are not authorized to use this command.</b>', { parse_mode: 'HTML' });
  }

  if (userLinkGeneration[targetUserId]) {
    // Reset the link generation count but keep the reset date to today's date
    userLinkGeneration[targetUserId] = { count: 0, resetDate: moment().startOf('day').toDate() };
    bot.sendMessage(msg.chat.id, `✅ <b>User ${targetUserId}'s link generation limit has been reset.</b>`, { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(msg.chat.id, `⚠️ <b>No record found for user ${targetUserId}.</b>`, { parse_mode: 'HTML' });
  }
});

// Log when the bot starts
console.log('✨ Ultra-stylish Telegram bot with broadcasting and admin features is now live! 🚀');
