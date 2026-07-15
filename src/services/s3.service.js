import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import crypto from "crypto";

const s3 = new S3Client({ region: env.awsRegion }); // IAM role on EC2

const PREFIX = { kitchen: "kitchen", profile: "profile", dish: "dish" };
export function buildKey(cookId, type, contentType) {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const rand = crypto.randomBytes(6).toString("hex");
  return `cooks/${cookId}/${PREFIX[type]}_${rand}.${ext}`;
}

export async function presignPut(key, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: env.s3PresignExpires });
}

export async function presignGet(key) {
  const cmd = new GetObjectCommand({ Bucket: env.s3Bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: env.s3PresignExpires });
}

export async function getObjectBytes(key) {
  const out = await s3.send(
    new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
  );
  const chunks = [];
  for await (const c of out.Body) chunks.push(c);
  return Buffer.concat(chunks);
}
