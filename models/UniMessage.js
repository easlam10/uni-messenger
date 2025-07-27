const mongoose = require("mongoose");

const uniMessageSchema = new mongoose.Schema(
  {
    university: {
      type: String,
      required: true,
      enum: ["NUST", "GIKI", "PIEAS", "FAST", "NUMS"],
    },
    messageIndex: {
      type: Number,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    messageContent: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    sentAt: Date,
  },
  {
    collection: "uni-messages",
  }
);

// Compound index to ensure uniqueness of university+messageIndex combination
uniMessageSchema.index({ university: 1, messageIndex: 1 }, { unique: true });

module.exports = mongoose.model("UniMessage", uniMessageSchema);
