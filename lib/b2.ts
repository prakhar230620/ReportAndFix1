import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3ClientInstance: S3Client | null = null;

export function getB2Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance;

  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION || "eu-central-003";
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing Backblaze B2 credentials (B2_ENDPOINT, B2_KEY_ID, B2_APPLICATION_KEY) in environment."
    );
  }

  s3ClientInstance = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3ClientInstance;
}

export function getB2BucketName(): string {
  return process.env.B2_BUCKET || "reportandfix-files";
}

/**
 * Uploads a file buffer directly to Backblaze B2
 */
export async function uploadToB2(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ key: string }> {
  const client = getB2Client();
  const bucket = getB2BucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return { key: storagePath };
}

/**
 * Retrieves a file buffer directly from Backblaze B2
 */
export async function getFromB2(
  storagePath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = getB2Client();
  const bucket = getB2BucketName();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: storagePath,
      })
    );

    if (!response.Body) return null;

    const streamToBuffer = async (stream: any): Promise<Buffer> => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    };

    const buffer = await streamToBuffer(response.Body);
    return {
      buffer,
      contentType: response.ContentType || "image/jpeg",
    };
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Generates an S3 pre-signed URL for direct access to Backblaze B2
 */
export async function getB2SignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getB2Client();
  const bucket = getB2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storagePath,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Deletes an object from Backblaze B2
 */
export async function deleteFromB2(storagePath: string): Promise<void> {
  const client = getB2Client();
  const bucket = getB2BucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storagePath,
    })
  );
}
