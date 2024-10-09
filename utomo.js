const { WA_DEFAULT_EPHEMERAL, generateWAMessageFromContent, proto, generateWAMessageContent, generateWAMessage, prepareWAMessageMedia, areJidsSameUser, getContentType } = require("@adiwajshing/baileys");
const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const { Configuration, OpenAIApi } = require("openai");
let setting = require("./key.json");

// Load custom prompt from file
    const customPrompt = fs.readFileSync("prompts.txt", "utf-8");

// Load chat history from file
const chatHistory = readChatHistoryFromFile();

// Utility function to read chat history from file
function readChatHistoryFromFile() {
  try {
    const data = fs.readFileSync("chat_history.json", "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}
// Utility function to write chat history to file
function writeChatHistoryToFile(chatHistory) {
  fs.writeFileSync("chat_history.json", JSON.stringify(chatHistory));
}

// Utility function to update chat history
function updateChatHistory(sender, message) {
  // If this is the first message from the sender, create a new array for the sender
  if (!chatHistory[sender]) {
    chatHistory[sender] = [];
  }
  // Add the message to the sender's chat history
  chatHistory[sender].push(message);
  // If the chat history exceeds the maximum length of 20 messages, remove the oldest message
  if (chatHistory[sender].length > 20) {
    chatHistory[sender].shift();
  }
}


module.exports = utomo = async (client, m, chatUpdate, store) => {
  try {
    if (!chatHistory[m.sender]) chatHistory[m.sender] = [];
    var body =
      m.mtype === "conversation"
        ? m.message.conversation
        : m.mtype == "imageMessage"
        ? m.message.imageMessage.caption
        : m.mtype == "videoMessage"
        ? m.message.videoMessage.caption
        : m.mtype == "extendedTextMessage"
        ? m.message.extendedTextMessage.text
        : m.mtype == "buttonsResponseMessage"
        ? m.message.buttonsResponseMessage.selectedButtonId
        : m.mtype == "listResponseMessage"
        ? m.message.listResponseMessage.singleSelectReply.selectedRowId
        : m.mtype == "templateButtonReplyMessage"
        ? m.message.templateButtonReplyMessage.selectedId
        : m.mtype === "messageContextInfo"
        ? m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text
        : "";
    var budy = typeof m.text === "string" ? m.text : "";
    const text = m.text;
    var prefix = /^[\\/!#.]/gi.test(body) ? body.match(/^[\\/!#.]/gi) : "/";
    const isCmd2 = body.startsWith(prefix) || text.startsWith("!");
    const command = body.replace(prefix, "").trim().split(/ +/)[0].toLowerCase() || text.trim().split(/ +/)[0].toLowerCase();
    const args = body.trim().split(/ +/).slice(1) || text.trim().split(/ +/).slice(1);
    const pushname = m.pushName || "No Name";
    const botNumber = await client.decodeJid(client.user.id);
    const itsMe = m.sender == botNumber ? true : false;
    let joinedArgs = (q = args.join(" "));
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    const arg1 = arg.trim().substring(arg.indexOf(" ") + 1);

    const from = m.chat;
    const reply = m.reply;
    const sender = m.sender;
    const mek = chatUpdate.messages[0];

    const color = (text, color) => {
      return !color ? chalk.green(text) : chalk.keyword(color)(text);
    };
    
    // Group
    const groupMetadata = m.isGroup ? await client.groupMetadata(m.chat).catch((e) => {}) : "";
    const groupName = m.isGroup ? groupMetadata.subject : "";

    // Push Message To Console
    let argsLog = budy.length > 30 ? `${q.substring(0, 30)}...` : budy;

    if (setting.autoAI) {
        // Push Message To Console && Auto Read
        if (argsLog && !m.isGroup) {
        // client.sendReadReceipt(m.chat, m.sender, [m.key.id])
        console.log(chalk.black(chalk.bgWhite('[ LOGS ]')), color(argsLog, 'turquoise'), chalk.magenta('From'), chalk.green(pushname), chalk.yellow(`[ ${m.sender.replace('@s.whatsapp.net', '')} ]`));
      } else if (argsLog && m.isGroup) {
        console.log(chalk.black(chalk.bgWhite('[ LOGS ]')), color(argsLog, 'turquoise'), chalk.magenta('From'), chalk.green(pushname), chalk.yellow(`[ ${m.sender.replace('@s.whatsapp.net', '')} ]`), chalk.blueBright('IN'), chalk.green(groupName));
      }
    } else if (!setting.autoAI) {
      if (isCmd2 && !m.isGroup) {
        console.log(chalk.black(chalk.bgWhite("[ LOGS ]")), color(argsLog, "turquoise"), chalk.magenta("From"), chalk.green(pushname), chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`));
      } else if (isCmd2 && m.isGroup) {
        console.log(
          chalk.black(chalk.bgWhite("[ LOGS ]")),
          color(argsLog, "turquoise"),
          chalk.magenta("From"),
          chalk.green(pushname),
          chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`),
          chalk.blueBright("IN"),
          chalk.green(groupName)
        );
      }
    }

    if (setting.autoAI) {
  if (isCmd2) {
    switch (command) {
      case "test":
        // add test command functionality here
        break;
      default:
        // add default case here
        break;
    }
  }
  // If the message is not a command, use OpenAI to generate a response
  else {
    // If OpenAI API key is not configured, return and do nothing
    if (setting.keyopenai === "ISI_APIKEY_OPENAI_DISINI") return;
    // Create OpenAI API client
    const configuration = new Configuration({
      apiKey: setting.keyopenai,
    });
    const openai = new OpenAIApi(configuration);

    // Create chat completion request using previous messages from chat history
    const messages = [
      { role: "system", content: customPrompt },
      ...(chatHistory[m.sender]?.map((msg) => ({ role: msg.role, content: msg.content })) || []),
      { role: "user", content: text },
    ];

    try {
      // Use OpenAI to generate response based on chat history and incoming message
      const response = await openai.createChatCompletion({
        model: "gpt-4",
        messages: messages,
        temperature: 0.1,
        max_tokens: 1500,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      });

      // Update chat history with incoming message and OpenAI-generated response
      updateChatHistory(m.sender, { role: "user", content: text });
      updateChatHistory(m.sender, { role: "assistant", content: response.data.choices[0].message.content });

      // Reply to the incoming message with OpenAI-generated response
      if (setting.reply === true) {  
        // Jika true, gunakan m.reply  
        m.reply(`${response.data.choices[0].message.content}`);  
      } else {  
        // Jika false, gunakan client.sendMessage tanpa quoted  
        await client.sendMessage(m.chat, { text: response.data.choices[0].message.content }, { quoted: null });  
      }  
    } catch (error) {
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
        console.log(`${error.response.status}\n\n${error.response.data}`);
      } else {
        console.log(error);
        m.reply("Maaf, sepertinya ada yang error: " + error.message);
      }
    }
  }
}
 
if (!setting.autoAI) {
  if (isCmd2) {
    switch (command) {
      case "help":
      case "menu":
        m.reply(`*AI*
        
*(ChatGPT)*
Cmd: ${prefix}ai 
Tanyakan apa saja kepada AI. 

*(Pemilik Bot)*
Cmd: ${prefix}owner
Menampilkan pemilik bot`);
        break;
      case "ai":
      case "openai":
        try {
          if (setting.keyopenai === "ISI_APIKEY_OPENAI_DISINI") return;
          // Membuat klien API OpenAI
          const configuration = new Configuration({
            apiKey: setting.keyopenai,
          });
          const openai = new OpenAIApi(configuration);
      
          // Membuat permintaan penyelesaian obrolan menggunakan pesan sebelumnya dari riwayat obrolan
          const messages = [
            { role: "system", content: customPrompt },
            ...(chatHistory[m.sender]?.map((msg) => ({ role: msg.role, content: msg.content })) || []),
            { role: "user", content: text },
          ];
      
          try {
            // Gunakan OpenAI untuk menghasilkan respons berdasarkan riwayat obrolan dan pesan masuk
            const response = await openai.createChatCompletion({
              model: "gpt-4",
              messages: messages,
              temperature: 0,
              max_tokens: 1500,
              top_p: 1.0,
              frequency_penalty: 0.0,
              presence_penalty: 0.0,
            });
      
            // Perbarui riwayat obrolan dengan pesan masuk dan respons yang dihasilkan OpenAI
            updateChatHistory(m.sender, { role: "user", content: text });
            updateChatHistory(m.sender, { role: "assistant", content: response.data.choices[0].message.content });
      
            // Balas pesan masuk dengan respons yang dihasilkan OpenAI
            if (setting.reply === true) {  
              // Jika true, gunakan m.reply  
              m.reply(`${response.data.choices[0].message.content}`);  
            } else {  
              // Jika false, gunakan client.sendMessage tanpa quoted  
              await client.sendMessage(m.chat, { text: response.data.choices[0].message.content }, { quoted: null });  
            }
          } catch (error) {
            if (error.response) {
              console.log(error.response.status);
              console.log(error.response.data);
              console.log(`${error.response.status}\n\n${error.response.data}`);
            } else {
              console.log(error);
              m.reply("Maaf, sepertinya ada yang error: " + error.message);
            }
          }
        } catch (error) {
          console.log(error);
        }

            break;
          case "owner":
          case "pemilik":
          case "punya":
            m.reply(setting.ownerbot);
            break;
          default: {
            if (isCmd2 && budy.toLowerCase() != undefined) {
              if (m.chat.endsWith("broadcast")) return;
              if (m.isBaileys) return;
              if (!budy.toLowerCase()) return;
              if (argsLog || (isCmd2 && !m.isGroup)) {
                // client.sendReadReceipt(m.chat, m.sender, [m.key.id])
                console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("tidak tersedia", "turquoise"));
              } else if (argsLog || (isCmd2 && m.isGroup)) {
                // client.sendReadReceipt(m.chat, m.sender, [m.key.id])
                console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("tidak tersedia", "turquoise"));
              }
            }
          }
        }
      }
    }
  } catch (err) {
    m.reply(util.format(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
