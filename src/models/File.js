import mongoose from "mongoose";
import { S3 } from "@aws-sdk/client-s3";

const s3 = new S3({ region: process.env.AWS_DEFAULT_REGION });

const FileSchema = new mongoose.Schema({
  name: String,
  size: Number,
  key: String,
  url: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

FileSchema.pre("save", function () {
  if (!this.url) {
    this.url = `${process.env.APP_URL}/files/${this.key}`;
  }
});

// Middleware pré-delete para remover o objeto do Amazon S3
FileSchema.pre("findOneAndDelete", async function () {
  const file = await this.model.findOne(this.getQuery());

  if (!file) {
    throw new Error("File not found");
  }

  if (process.env.STORAGE_TYPE === "s3") {
    try {
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: file.key,
      };
      await s3.deleteObject(params);
      console.log(`Object ${file.key} deleted from S3`);
    } catch (error) {
      console.error(`Error deleting object from S3: ${error.message}`);
      throw new Error(`Error deleting object from S3: ${error.message}`);
    }
  }
});

FileSchema.pre("findOneAndUpdate", async function () {
  const file = await this.model.findOne(this.getQuery());

  if (!file) {
    throw new Error("File not found");
  }

  if (process.env.STORAGE_TYPE === "s3") {
    try {
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: file.key,
      };
      await s3.deleteObject(params);
      console.log(`Object ${file.key} deleted from S3`);
    } catch (error) {
      console.error(`Error deleting object from S3: ${error.message}`);
      throw new Error(`Error deleting object from S3: ${error.message}`);
    }
  }
});

const File = mongoose.model("File", FileSchema);

export default File;
