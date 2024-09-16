// Load environment variables
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const moment = require('moment'); // For handling date and time

// Telegram Bot Token
const TOKEN = process.env.TOKEN;

// List of admin user IDs
const ADMIN_IDS = [6020805369, 6013132170]; // Replace with actual admin IDs

// Initialize the bot
const bot = new TelegramBot(TOKEN, { polling: true });

// Sections with channels
const SECTIONS = {
  'Alien Test Series': [
    { name: 'Alien NEET Test Series', id: '-1002224862570' },
    { name: 'Alien Nurture 11th', id: '-1002216495058' },
    { name: 'Alien JEE Test Series', id: '-1002024377118' },
    { name: 'Alien Chapter Wise Test', id: '-1001111111114' },
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
  ]
};

// Store active invite links and users who used the bot
let activeLinks = {}; // Structure: { chatId: { channelId, inviteLink } }
let userUsageCount = 0;
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

// Function to handle the user's request within a section
const handleChannelRequest = async (msg, sectionName) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let sectionChannels = SECTIONS[sectionName];

  if (!sectionChannels) {
    return bot.sendMessage(chatId, '❌ <b>Invalid section name!</b> Please try again.', { parse_mode: 'HTML' });
  }

  let channelList = `
✨ <b><u>Choose Your Channel from the ${sectionName}</u></b> ✨
📋 <i>Select from the channels below:</i>\n`;

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

        const greetingMessage = `🎉 <b>Congratulations ${msg.from.first_name}!</b> 🎉
You’ve unlocked access to <b><u>${selectedChannel.name}</u></b>! 🌟`;

        bot.sendMessage(chatId, greetingMessage, { parse_mode: 'HTML' });

        const linkMessage = `🔗 <b>Your invite link:</b> <code>${inviteLink}</code>
⏳ <i>This link will expire in <b>5 minutes</b>!</i>`;

        bot.sendMessage(chatId, linkMessage, { parse_mode: 'HTML' });

        // Revoke the invite link after 5 minutes
        setTimeout(async () => {
          await revokeInviteLink(selectedChannel.id, inviteLink);
          bot.sendMessage(chatId, `⏳ <b>The invite link for <code>${selectedChannel.name}</code> has expired!</b>`, { parse_mode: 'HTML' });
          delete activeLinks[chatId];
        }, 300000);  // 5 minutes
      } else {
        bot.sendMessage(chatId, '⚠️ <b>Error generating the invite link. Please try again later.</b>', { parse_mode: 'HTML' });
      }
    } else {
      bot.sendMessage(chatId, '❌ <b>Invalid channel name!</b> Please try again.', { parse_mode: 'HTML' });
    }

    // Prompt for another channel in the same section
    bot.sendMessage(chatId, '🔄 <b>Would you like to select another channel from this section?</b> Type the channel name or /exit to switch sections.', { parse_mode: 'HTML' });

    // Handle response for selecting another channel or exiting
    bot.once('message', (response) => {
      if (response.text.toLowerCase() === '/exit') {
        return bot.sendMessage(chatId, '🔄 <b>You have exited the section. Type /tlink to choose a new section.</b>', { parse_mode: 'HTML' });
      }

      handleChannelRequest(response, sectionName); // Recur to handle another channel request
    });
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

  // Check if the user has exceeded the daily limit
  const userGeneration = userLinkGeneration[userId] || { count: 0, resetDate: moment().startOf('day').toDate() };
  if (userGeneration.count >= 7) {
    return bot.sendMessage(chatId, '⚠️ <b>You’ve reached your daily limit of generating invite links.</b> Please try again tomorrow. 🌅', { parse_mode: 'HTML' });
  }

  // Increment the user's link generation count
  userLinkGeneration[userId] = { count: userGeneration.count + 1, resetDate: userGeneration.resetDate };

  // Build a formatted section list
  let sectionList = `
✨ <b><u>Choose Your Section to Receive Your Invite Link</u></b> ✨
📋 <i>Select from the sections below:</i>\n`;

  Object.keys(SECTIONS).forEach((section) => {
    sectionList += `🔹 <code>${section}</code>\n`;
  });

  bot.sendMessage(chatId, sectionList, { parse_mode: 'HTML' });

  bot.once('message', async (response) => {
    const selectedSection = Object.keys(SECTIONS).find(section => section.toLowerCase() === response.text.toLowerCase());
    if (selectedSection) {
      handleChannelRequest(msg, selectedSection);
    } else {
      bot.sendMessage(chatId, '❌ <b>Invalid section name!</b> Please try again.', { parse_mode: 'HTML' });
    }
  });
});

// Admin-only command: /status
bot.onText(/\/status/, (msg) => {
  const userId = msg.from.id;
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, '🚫 <b>You are not authorized to use this command.</b>', { parse_mode: 'HTML' });
  }

  const statusMessage = `
📊 <b>Bot Status:</b>
👥 <b>Total users:</b> ${userUsageCount}
🔗 <b>Active links:</b> ${Object.keys(activeLinks).length}
📡 <b>Total sections:</b> ${Object.keys(SECTIONS).length}
  `;
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
      console.error(`Failed to broadcast message to user ${user}: ${error.message}`);
    }
  }

  bot.sendMessage(msg.chat.id, '📣 <b>Broadcast message sent to all users.</b>', { parse_mode: 'HTML' });
});

// Log when the bot starts
console.log('✨ Ultra-stylish Telegram bot with broadcasting and admin features is now live! 🚀');
