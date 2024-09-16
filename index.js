require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Get the bot token from environment variables
const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// List of available channels (replace with your channel usernames)
const CHANNELS = [
  { name: 'Kawakize', id: '@your_channel_username1' },
  { name: 'channel2', id: '@your_channel_username2' },
  { name: 'channel3', id: '@your_channel_username3' },
];

// Function to generate an invite link
async function generateInviteLink(channelId) {
  try {
    const inviteUrl = `https://api.telegram.org/bot${TOKEN}/exportChatInviteLink`;
    const response = await axios.post(inviteUrl, { chat_id: channelId });
    return response.data.result;
  } catch (error) {
    console.error('Error generating invite link:', error);
  }
}

// Function to revoke the invite link
async function revokeInviteLink(chatId, inviteLink) {
  try {
    const revokeUrl = `https://api.telegram.org/bot${TOKEN}/revokeChatInviteLink`;
    const response = await axios.post(revokeUrl, {
      chat_id: chatId,
      invite_link: inviteLink
    });
    return response.data;
  } catch (error) {
    console.error('Error revoking invite link:', error);
  }
}

// Bot command handler for /getlink
bot.onText(/\/getlink/, (msg) => {
  const chatId = msg.chat.id;
  let channelList = 'Please choose a channel by typing its exact name:\n';
  CHANNELS.forEach((channel) => {
    channelList += `- \`${channel.name}\`\n`;  // Monospace format using Markdown
  });

  bot.sendMessage(chatId, channelList, { parse_mode: 'Markdown' });

  bot.once('message', async (response) => {
    console.log('Received message:', response.text);  // Log user input
    const selectedChannel = CHANNELS.find(channel => channel.name.toLowerCase() === response.text.toLowerCase());
    if (selectedChannel) {
      const inviteLink = await generateInviteLink(selectedChannel.id);
      bot.sendMessage(chatId, `Here is your invite link for \`${selectedChannel.name}\`: ${inviteLink}\nIt is valid for 5 minutes.`, { parse_mode: 'Markdown' });

      setTimeout(async () => {
        await revokeInviteLink(selectedChannel.id, inviteLink);
        bot.sendMessage(chatId, `The invite link for \`${selectedChannel.name}\` has expired.`, { parse_mode: 'Markdown' });
      }, 300000);  // 5 minutes
    } else {
      bot.sendMessage(chatId, 'Invalid channel name. Please try again.');
    }
  });
});

console.log('Bot is running...');
