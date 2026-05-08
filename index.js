require("dotenv").config();

const OWNER_ID = "1133386291858382939";

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧠 Harry (Hyeri Brain) Running"));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🌐 Server running"));

// ================= DISCORD =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= MEMORY =================
let memory = { projects: {}, users: {} };

if (fs.existsSync("memory_draco.json")) {
  memory = JSON.parse(fs.readFileSync("memory_draco.json"));
}

function saveMemory() {
  fs.writeFileSync("memory_draco.json", JSON.stringify(memory, null, 2));
}

// ================= ETA =================
function getETA(position) {
  return `~${position * 10} seconds`;
}

// ================= QUEUE =================
let queue = [];
let isProcessing = false;

async function updateQueueUI() {
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const pos = i + 1;
    const eta = getETA(pos);

    let text = `⏳ Queue position: #${pos}\n⏱ ETA: ${eta}`;

    if (pos === 1) text += "\n🟡 You are next...";
    else text += "\n⬆️ Moving up...";

    try {
      await job.statusMsg.edit(`👀 Got your request!\n${text}`);
    } catch {}
  }
}

// ================= PROCESS =================
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const job = queue.shift();
  const { message, project, msg, statusMsg } = job;

  updateQueueUI();

  let typing = true;
  const typingInterval = setInterval(() => {
    if (typing) message.channel.sendTyping().catch(() => {});
  }, 3000);

  try {
    await statusMsg.edit("⚙️ Understanding template...");
    await statusMsg.edit("🛠 Editing merchant HTML...");

let html = project.template;

function getValue(tag, text) {
  const regex = new RegExp(
    `\\[${tag}\\]([\\s\\S]*?)(?=\\n\\[|$)`
  );

  return regex.exec(text)?.[1]?.trim() || "";
}

function formatParagraphs(text) {
  return text
    .split("\n\n")
    .map(p =>
      `<p style="margin:0 0 16px 0; line-height:1.6;">${
        p.replace(/\n/g, "<br>")
      }</p>`
    )
    .join("");
}

html = html.replaceAll(
  "{{TOP_NAME}}",
  getValue("TOP_NAME", msg)
);

html = html.replaceAll(
  "{{TOP_EMAIL}}",
  getValue("TOP_EMAIL", msg)
);

html = html.replaceAll(
  "{{SUBJECT_LINE}}",
  getValue("SUBJECT_LINE", msg)
);

html = html.replaceAll(
  "{{TO_EMAIL}}",
  getValue("TO_EMAIL", msg)
);

html = html.replaceAll(
  "{{DATE}}",
  getValue("DATE", msg)
);

html = html.replaceAll(
  "{{MERCHANT_RESPONSE}}",
  getValue("MERCHANT_RESPONSE", msg)
);

html = html.replaceAll(
  "{{REQUEST_ID}}",
  getValue("REQUEST_ID", msg)
);

html = html.replaceAll(
  "{{MAIN_BODY}}",
  formatParagraphs(
    getValue("MAIN_BODY", msg)
  )
);

html = html.replaceAll(
  "{{SIGNATURE}}",
  getValue("SIGNATURE", msg)
);

html = html.replaceAll(
  "{{ATTACHMENT}}",
  getValue("ATTACHMENT", msg)
);

html = html.replaceAll(
  "{{ATTACHMENT_SIZE}}",
  getValue("ATTACHMENT_SIZE", msg)
);

html = html.replaceAll(
  "{{FROM_NAME}}",
  getValue("FROM_NAME", msg)
);

html = html.replaceAll(
  "{{FROM_EMAIL}}",
  getValue("FROM_EMAIL", msg)
);

html = html.replaceAll(
  "{{ORIGINAL_HEADER}}",
  getValue("ORIGINAL_HEADER", msg)
);

html = html.replaceAll(
  "{{ORIGINAL_SUBJECT}}",
  getValue("ORIGINAL_SUBJECT", msg)
);

html = html.replaceAll(
  "{{ORIGINAL_MESSAGE}}",
  formatParagraphs(
    getValue("ORIGINAL_MESSAGE", msg)
  )
);

html = html.replaceAll(
  "{{TRACKING}}",
  getValue("TRACKING", msg)
);

    typing = false;
    clearInterval(typingInterval);

    if (!html) return statusMsg.edit("⚠️ Failed to generate.");

    const fileName = `output_${Date.now()}.html`;
    fs.writeFileSync(fileName, html);

    await statusMsg.edit({
      content: "✅ Generation complete",
      files: [fileName]
    });

  } catch (err) {
    console.error(err);
    await statusMsg.edit("❌ Error occurred.");
  }

  isProcessing = false;
  processQueue();
}

// ================= READY =================
client.once("ready", () => {
  console.log("Draco logged in: " + client.user.tag);
});

// ================= MAIN =================
const processedMessages = new Map();

client.on("messageCreate", async (message) => {

  // ================= DUPLICATE BLOCKER =================
const now = Date.now();

const lastProcessed =
  processedMessages.get(message.id);

if (
  lastProcessed &&
  now - lastProcessed < 30000
) {
  return;
}

processedMessages.set(
  message.id,
  now
);

  // ================= IGNORE BOTS =================
  if (message.author.bot) return;

  const channel = message.channel.name;

  const allowed =
    channel.startsWith("draco-merchant-") ||
    channel === "hogwarts-battlefield";

  if (!allowed) return;

  if (!message.mentions.has(client.user.id)) return;

  let msg = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  const userId = message.author.id;

  // ================= USER MEMORY =================
  if (!memory.users[userId]) {
    memory.users[userId] = {
      project: null
    };
  }

  // ================= SET PROJECT =================
  if (msg.toLowerCase().startsWith("project:")) {

    const name = msg
      .split(":")[1]
      ?.trim()
      .toLowerCase();

    if (!memory.projects[name]) {
      return message.reply("❌ Project not found.");
    }

    memory.users[userId].project = name;

    saveMemory();

    return message.reply(
      "👀 Project set to: " + name
    );
  }

  // ================= TRAIN PROJECT =================
  if (msg.toLowerCase().startsWith("train project:")) {

    if (message.channel.name !== "hogwarts-battlefield") {
      return;
    }

    if (message.author.id !== OWNER_ID) {
      return message.reply(
        "❌ Only owner can train."
      );
    }

    const name = msg
      .split(":")[1]
      ?.trim()
      .toLowerCase();

    memory.projects[name] = {
      template: null
    };

    memory.users[userId].project = name;

    saveMemory();

    await message.reply(
      "🧠 Training started for: " + name
    );

    // wait for attachment only
    if (message.attachments.size === 0) {
      return;
    }
  }

  // ================= FILE READER =================
  if (message.attachments.size > 0) {

    const file = message.attachments.first();

    // ================= HTML TRAINING =================
    if (file.name.endsWith(".html")) {

      if (message.author.id !== OWNER_ID) {
        return;
      }

      const res = await fetch(file.url);
      const html = await res.text();

      const projectName =
        memory.users[userId]?.project;

      if (!projectName) {
        return message.reply(
          "⚠️ No active project."
        );
      }

      // duplicate save blocker
      if (
        memory.projects[projectName].template === html
      ) {
        return;
      }

      memory.projects[projectName].template = html;

      saveMemory();

      return message.reply(
        "🧠 Template saved for: " +
        projectName
      );
    }

    // ================= TXT FILE =================
    if (file.name.endsWith(".txt")) {

      try {

        const res = await fetch(file.url);
        const text = await res.text();

        msg += "\n" + text;

        await message.reply(
          "📄 TXT file loaded!"
        );

      } catch (err) {

        console.error(err);

        return message.reply(
          "❌ Failed to read TXT file."
        );
      }
    }
  }

  // ================= PASTE TEMPLATE =================
  if (msg.includes("<html")) {

    if (message.author.id !== OWNER_ID) {
      return;
    }

    const projectName =
      memory.users[userId]?.project;

    if (!projectName) {
      return message.reply(
        "⚠️ No active project."
      );
    }

    memory.projects[projectName].template = msg;

    saveMemory();

    return message.reply(
      "🧠 Template saved for: " +
      projectName
    );
  }

  // ================= GENERATE =================
  if (msg.toLowerCase().includes("generate")) {

    const position = queue.length + 1;
    const eta = getETA(position);

    const statusMsg = await message.reply(
      "👀 Got your request!\n⏳ Queue position: #" +
      position +
      "\n⏱ ETA: " +
      eta
    );

    const projectName =
      memory.users[userId]?.project;

    if (!projectName) {
      return message.reply(
        "⚠️ Please set project first."
      );
    }

    const project =
      memory.projects[projectName];

    if (!project?.template) {
      return message.reply(
        "❌ Template not found."
      );
    }

    queue.push({
      message,
      project,
      msg,
      statusMsg
    });

    updateQueueUI();
    processQueue();
  }
});
// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);