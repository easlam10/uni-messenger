require("dotenv").config();
const mongoose = require("mongoose");
const { Client, RemoteAuth } = require("whatsapp-web.js");
const { MongoStore } = require("wwebjs-mongo");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return false;
  }
};

// Import the UniMessage model
const UniMessage = require("./models/UniMessage");

// Create WhatsApp client
let client;
let isClientReady = false;

const initWhatsApp = async () => {
  // Create MongoDB store for WhatsApp session
  const store = new MongoStore({ mongoose });

  client = new Client({
    authStrategy: new RemoteAuth({
      store: store,
      backupSyncIntervalMs: 300000, // Sync every 5 minutes
      clientId: "app2", // Different client ID from the scraper app
    }),
    puppeteer: {
      args: ["--no-sandbox"],
      headless: true,
    },
  });

  // Handle QR code generation
  client.on("qr", (qr) => {
    console.log("No saved session found. Please scan this QR code:");
    qrcode.generate(qr, { small: true });

    // Save QR code to file for remote access
    fs.writeFileSync(path.join(__dirname, "qr-code.txt"), qr);
    console.log("QR code also saved to qr-code.txt");
  });

  // Authentication events
  client.on("authenticated", () => {
    console.log("Authentication successful!");
  });

  client.on("remote_session_saved", () => {
    console.log("Session saved to MongoDB!");
  });

  // Ready event
  client.on("ready", () => {
    isClientReady = true;
    console.log("Client is ready! Session loaded from MongoDB.");
    // Once client is ready, process pending messages
    processMessages();
  });

  client.on("disconnected", () => {
    isClientReady = false;
    console.log("WhatsApp client disconnected. Attempting to reconnect...");
    setTimeout(() => initWhatsApp(), 5000);
  });

  // Initialize the client
  console.log("Initializing WhatsApp client...");
  await client.initialize();
};

// Function to format phone number for WhatsApp
const formatPhoneNumber = (phoneNumber) => {
  return phoneNumber.replace(/\D/g, "");
};

// Function to wait for client to be ready
const waitForReady = async () => {
  if (isClientReady) return;

  console.log("Waiting for WhatsApp client to be ready...");
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (isClientReady) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });
};

// Function to process and send pending messages
const processMessages = async () => {
  try {
    await waitForReady();
    console.log("Looking for pending messages...");

    // Find all pending messages
    const pendingMessages = await UniMessage.find({ status: "pending" }).sort({
      university: 1,
      messageIndex: 1,
    });

    if (pendingMessages.length === 0) {
      console.log("No pending messages found.");
      return;
    }

    console.log(
      `Found ${pendingMessages.length} pending messages. Processing...`
    );

    // Process messages one by one
    for (const message of pendingMessages) {
      try {
        // Format number for WhatsApp
        const formattedNumber = formatPhoneNumber(message.phoneNumber);
        const chatId = `${formattedNumber}@c.us`;

        console.log(
          `Sending message ${message.university} #${message.messageIndex} to ${message.phoneNumber}...`
        );

        // Send the message
        await client.sendMessage(chatId, message.messageContent);

        // Update message status to sent
        message.status = "sent";
        message.sentAt = new Date();
        await message.save();

        console.log(
          `✅ Message sent and marked as delivered: ${message.university} #${message.messageIndex}`
        );

        // Add a 5-second delay between messages to avoid rate limiting
        console.log("Waiting 5 seconds before sending next message...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (messageError) {
        console.error(
          `❌ Error sending message ${message.university} #${message.messageIndex}:`,
          messageError
        );

        // Mark message as failed
        message.status = "failed";
        await message.save();
      }
    }

    console.log("✅ All pending messages processed!");

    // Option to delete sent messages (could be controlled with an environment variable)
    if (process.env.DELETE_SENT_MESSAGES === "true") {
      console.log("Deleting sent messages from database...");
      await UniMessage.deleteMany({ status: "sent" });
      console.log("✅ Sent messages deleted from database.");
    }
  } catch (error) {
    console.error("❌ Error processing messages:", error);
  }
};

// Main function
const main = async () => {
  // Connect to MongoDB
  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to database. Exiting...");
    process.exit(1);
  }

  // Initialize WhatsApp client
  await initWhatsApp();
};

// Start the application
main().catch((err) => {
  console.error("Application error:", err);
  process.exit(1);
});
