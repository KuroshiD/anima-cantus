import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly bucket = process.env.S3_BUCKET ?? "contratos";
  private readonly internal: S3Client;
  private readonly signer: S3Client;

  constructor() {
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "anima",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "anima_minio_dev_secret",
    };
    const region = process.env.S3_REGION ?? "us-east-1";
    this.internal = new S3Client({
      region,
      endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
      forcePathStyle: true,
      credentials,
    });
    this.signer = new S3Client({
      region,
      endpoint: process.env.S3_PUBLIC_ENDPOINT ?? "http://storage.localhost",
      forcePathStyle: true,
      credentials,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!(error instanceof Error) || !error.name.includes("BucketAlready")) throw error;
    }
  }

  async presignPut(key: string, sizeBytes: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: "application/pdf",
      ContentLength: sizeBytes,
    });
    return getSignedUrl(this.signer, command, { expiresIn: 900 });
  }

  async putPdf(key: string, body: Uint8Array): Promise<void> {
    await this.internal.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "application/pdf",
      }),
    );
  }

  async read(key: string): Promise<{ body: Buffer; size: number }> {
    const head = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    const object = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) throw new Error("Arquivo vazio no armazenamento.");
    return { body: Buffer.from(bytes), size: head.ContentLength ?? bytes.length };
  }
}
