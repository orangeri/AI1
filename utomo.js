const { WA_DEFAULT_EPHEMERAL, generateWAMessageFromContent, proto, generateWAMessageContent, generateWAMessage, prepareWAMessageMedia, areJidsSameUser, getContentType, downloadContentFromMessage } = require("@adiwajshing/baileys");  
const fs = require("fs");  
const util = require("util");  
const chalk = require("chalk");  
const { Configuration, OpenAIApi } = require("openai");  
const axios = require("axios");  
const path = require('path');  
let setting = require("./key.json");  

const customPrompt = fs.readFileSync("prompts.txt", "utf-8");  

let chatHistory = readChatHistoryFromFile();  
const chatStatus = {};  

function readChatHistoryFromFile() {  
    try {  
        const data = fs.readFileSync("chat_history.json", "utf-8");  
        return JSON.parse(data);  
    } catch (err) {  
        return {};  
    }  
}  

function writeChatHistoryToFile(history) {  
    fs.writeFileSync("chat_history.json", JSON.stringify(history));  
}  

function updateChatHistory(sender, message) {  
    if (!chatHistory[sender]) {  
        chatHistory[sender] = [];  
    }  
    chatHistory[sender].push(message);  
    if (chatHistory[sender].length > 20) {  
        chatHistory[sender].shift();  
    }  
    writeChatHistoryToFile(chatHistory);  
}  

async function saveImageToFile(buffer, filename) {  
    const filePath = path.join(__dirname, 'images', filename);  
    fs.writeFileSync(filePath, buffer);  
    return filePath;  
}  

async function downloadMediaMessage(message) {  
    let buffer = Buffer.from([]);  
    const stream = await downloadContentFromMessage(message, message.mimetype.split('/')[0]);  
    for await (const chunk of stream) {  
        buffer = Buffer.concat([buffer, chunk]);  
    }  
    const filename = `${Date.now()}.jpg`;  
    const filePath = await saveImageToFile(buffer, filename);  
    return filePath;  
}  

function getLastImageMessage(sender) {  
    if (!chatHistory[sender]) return null;  
    for (let i = chatHistory[sender].length - 1; i >= 0; i--) {  
        if (chatHistory[sender][i].image) {  
            return chatHistory[sender][i];  
        }  
    }  
    return null;  
}  

function isImageContext(text) {  
    const imageQuestions = ['gambar', 'ada di gambar', 'lihat di gambar', 'foto', 'ada di foto', 'lihat di foto'];  
    return imageQuestions.some(keyword => text.toLowerCase().includes(keyword));  
}  

module.exports = utomo = async (client, m, chatUpdate, store) => {  
    try {  
        await client.readMessages([m.key]); // <<<<<< Auto read functionality  

        if (!chatHistory[m.sender]) chatHistory[m.sender] = [];  
        if (!chatStatus[m.sender]) chatStatus[m.sender] = { isImageContext: false };  

        const body = m.mtype === "conversation"  
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

        const prefix = /^[\\/!#.]/gi.test(body) ? body.match(/^[\\/!#.]/gi) : "/";  
        const isCmd2 = body.startsWith(prefix);  
        const command = body.replace(prefix, "").trim().split(/ +/)[0].toLowerCase();  
        const args = body.trim().split(/ +/).slice(1);  
        const pushname = m.pushName || "No Name";  
        const botNumber = await client.decodeJid(client.user.id);  
        const itsMe = m.sender == botNumber ? true : false;  
        let joinedArgs = (q = args.join(" "));  
        const arg = body.trim().substring(body.indexOf(" ") + 1);  
        const from = m.chat;  
        const sender = m.sender;  
        const groupMetadata = m.isGroup ? await client.groupMetadata(m.chat).catch((e) => { }) : "";  
        const groupName = m.isGroup ? groupMetadata.subject : "";  

        let argsLog = body.length > 30 ? `${q.substring(0, 30)}...` : body;  

        const color = (text, color) => {  
            return !color ? chalk.green(text) : chalk.keyword(color)(text);  
        };  

        // Handle .delmsg command regardless of setting.autoAI  
        if (isCmd2 && command === "delmsg") {  
            if (setting.delhistory) {  
                chatHistory = {};  
                writeChatHistoryToFile(chatHistory);  
                m.reply("Chat history telah dihapus.");  
            } else {  
                m.reply("Penghapusan chat history tidak diperbolehkan.");  
            }  
            return;  
        }  

        // Handle .delimg command  
        if (isCmd2 && command === "delimg") {  
            if (setting.delimages) {  // Periksa apakah delimages diset ke true  
                const imagesDir = path.join(__dirname, 'images');  
                fs.rmdirSync(imagesDir, { recursive: true });  
                fs.mkdirSync(imagesDir);  
                m.reply("Folder images telah dihapus dan dibuat ulang.");  
            } else {  
                m.reply("Penghapusan folder images tidak diperbolehkan.");  
            }  
            return;  
        }  

        if (setting.autoAI) {  
            if (argsLog && !m.isGroup) {  
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
                        // Implement a test command functionality here  
                        break;  
                    default:  
                        break;  
                }  
            } else {  
                if (setting.keyopenai === "ISI_APIKEY_OPENAI_DISINI") return;  

                const configuration = new Configuration({  
                    apiKey: setting.keyopenai,  
                });  
                const openai = new OpenAIApi(configuration);  

                if (m.mtype === "imageMessage") {  
                    try {  
                        const filePath = await downloadMediaMessage(m.message.imageMessage);  
                        const base64Image = fs.readFileSync(filePath, 'base64');  
                        if (base64Image) {  
                            const caption = m.message.imageMessage.caption || "";  
                            const messages = [  
                                { role: "system", content: customPrompt },  
                                ...(chatHistory[m.sender]?.map((msg) => ({ role: msg.role, content: msg.content })) || []),  
                                {  
                                    role: "user",  
                                    content: [  
                                        {  
                                            type: "text",  
                                            text: caption ? caption : customPrompt,  
                                        },  
                                        {  
                                            type: "image_url",  
                                            image_url: {  
                                                url: `data:image/jpeg;base64,${base64Image}`,  
                                            },  
                                        },  
                                    ],  
                                },  
                            ];  

                            chatStatus[m.sender].isImageContext = true;  
                            const validMessages = messages.filter(msg => msg && msg.content);  

                            try {  
                                const response = await openai.createChatCompletion({  
                                    model: setting.modelimg,  
                                    messages: validMessages,  
                                    max_tokens: 300,  
                                });  
                                const aiResponse = response.data.choices[0].message.content;  
                                updateChatHistory(m.sender, { role: "user", content: caption, image: base64Image });  
                                updateChatHistory(m.sender, { role: "assistant", content: aiResponse });  
                                if (setting.reply === true) {  
                                    m.reply(aiResponse);  
                                } else {  
                                    await client.sendMessage(m.chat, { text: aiResponse }, { quoted: null });  
                                }  
                            } catch (error) {  
                                console.error("Error processing image:", error);  
                                m.reply("Maaf, terjadi kesalahan saat memproses gambar.");  
                            }  
                        }  
                    } catch (error) {  
                        console.error("Error downloading image:", error);  
                        m.reply("Maaf, terjadi kesalahan saat mengunduh gambar.");  
                    }  
                } else {  
                    const lastImageMessage = getLastImageMessage(m.sender);  

                    if (!isImageContext(body)) {  
                        chatStatus[m.sender].isImageContext = false; // Reset if topic is changing  
                    }  

                    const messages = [  
                        { role: "system", content: customPrompt },  
                        ...(chatHistory[m.sender]?.map((msg) => ({ role: msg.role, content: msg.content })) || []),  
                        { role: "user", content: body }, // add the current text message  
                    ];  

                    if (lastImageMessage && chatStatus[m.sender].isImageContext) {  
                        messages.push({  
                            role: "user",  
                            content: [  
                                {  
                                    type: "text",  
                                    text: body,  
                                },  
                                {  
                                    type: "image_url",  
                                    image_url: {  
                                        url: `data:image/jpeg;base64,${lastImageMessage.image}`,  
                                    },  
                                },  
                            ],  
                        });  
                    } else {  
                        chatStatus[m.sender].isImageContext = false;  
                        messages.push({ role: "user", content: body });  
                    }  

                    const validMessages = messages.filter(msg => msg && msg.content);  

                    try {  
                        const response = await openai.createChatCompletion({  
                            model: chatStatus[m.sender].isImageContext ? setting.modelimg : setting.model,  
                            messages: validMessages,  
                            temperature: 0.1,  
                            max_tokens: 1500,  
                            top_p: 1.0,  
                            frequency_penalty: 0.0,  
                            presence_penalty: 0.0,  
                        });  
                        updateChatHistory(m.sender, { role: "user", content: body });  
                        updateChatHistory(m.sender, { role: "assistant", content: response.data.choices[0].message.content });  
                        if (setting.reply === true) {  
                            m.reply(`${response.data.choices[0].message.content}`);  
                        } else {  
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
        }  

        if (!setting.autoAI) {  
            if (isCmd2) {  
                switch (command) {  
                    case "help":  
                    case "menu":  
                        m.reply(`*AI*\n\n*(ChatGPT)*\nCmd: ${prefix}ai\nTanyakan apa saja kepada AI.\n*(Pemilik Bot)*\nCmd: ${prefix}owner\nMenampilkan pemilik bot`);  
                        break;  
                    case "ai":  
                    case "openai":  
                        try {  
                            if (setting.keyopenai === "ISI_APIKEY_OPENAI_DISINI") return;  
                            const configuration = new Configuration({  
                                apiKey: setting.keyopenai,  
                            });  
                            const openai = new OpenAIApi(configuration);  

                            const messages = [  
                                { role: "system", content: customPrompt },  
                                ...(chatHistory[m.sender]?.map((msg) => ({ role: msg.role, content: msg.content })) || []),  
                                { role: "user", content: body },  
                            ];  

                            const validMessages = messages.filter(msg => msg && msg.content);  

                            try {  
                                const response = await openai.createChatCompletion({  
                                    model: setting.model,  
                                    messages: validMessages,  
                                    temperature: 0,  
                                    max_tokens: 1500,  
                                    top_p: 1.0,  
                                    frequency_penalty: 0.0,  
                                    presence_penalty: 0.0,  
                                });  

                                updateChatHistory(m.sender, { role: "user", content: body });  
                                updateChatHistory(m.sender, { role: "assistant", content: response.data.choices[0].message.content });  

                                if (setting.reply === true) {  
                                    m.reply(`${response.data.choices[0].message.content}`);  
                                } else {  
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
                        if (isCmd2 && body.toLowerCase() != undefined) {  
                            if (m.chat.endsWith("broadcast")) return;  
                            if (m.isBaileys) return;  
                            if (!body.toLowerCase()) return;  
                            if (argsLog && (isCmd2 && !m.isGroup)) {  
                                console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("tidak tersedia", "turquoise"));  
                            } else if (argsLog && (isCmd2 && m.isGroup)) {  
                                console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("tidak tersedia", "turquoise"));  
                            }  
                        }  
                    }  
                }  
            }  
        }  

        if (setting.autodelimg) {  
            const imagesDir = path.join(__dirname, 'images');  
            fs.readdir(imagesDir, (err, files) => {  
                if (err) {  
                    console.error(err);  
                    return;  
                }  
                if (files.length > 5) {  
                    fs.rmdirSync(imagesDir, { recursive: true });  
                    fs.mkdirSync(imagesDir);  
                    console.log('Folder images telah dihapus dan dibuat ulang.');  
                }  
            });  
        }  

        if (setting.autodelmsg) {  
            const chatHistoryLength = Object.keys(chatHistory).length;  
            if (chatHistoryLength > 3) {  
                fs.writeFileSync("chat_history.json", "{}");  
                chatHistory = {};  
                console.log('Chat history telah dihapus.');  
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
