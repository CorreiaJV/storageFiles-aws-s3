import mongoose from "mongoose";
import { S3 } from "@aws-sdk/client-s3";

const s3 = new S3({ region: process.env.AWS_DEFAULT_REGION });

const PostSchema = new mongoose.Schema({
  name: String,
  size: Number,
  key: String,
  url: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

PostSchema.pre("save", function () {
  if (!this.url) {
    this.url = `${process.env.APP_URL}/files/${this.key}`;
  }
});

// Middleware pré-delete para remover o objeto do Amazon S3
PostSchema.pre("findOneAndDelete", async function () {
  const post = await this.model.findOne(this.getQuery());

  if (!post) {
    throw new Error("Post not found");
  }

  if (process.env.STORAGE_TYPE === "s3") {
    try {
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: post.key,
      };
      await s3.deleteObject(params);
      console.log(`Object ${post.key} deleted from S3`);
    } catch (error) {
      console.error(`Error deleting object from S3: ${error.message}`);
      throw new Error(`Error deleting object from S3: ${error.message}`);
    }
  }
});

const Post = mongoose.model("Post", PostSchema);

export default Post;
