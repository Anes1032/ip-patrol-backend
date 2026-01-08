import * as Minio from "minio";

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT?.split(":")[0] || "minio",
  port: parseInt(process.env.MINIO_ENDPOINT?.split(":")[1] || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const bucket = process.env.MINIO_BUCKET || "videos";

export async function uploadVideo(
  file: Buffer,
  objectName: string
): Promise<string> {
  await minioClient.putObject(bucket, objectName, file);
  return objectName;
}

export async function getPresignedUrl(objectName: string): Promise<string> {
  return await minioClient.presignedGetObject(bucket, objectName, 60 * 60);
}

export async function getObjectStream(objectName: string): Promise<NodeJS.ReadableStream> {
  return await minioClient.getObject(bucket, objectName);
}

export async function getObjectStat(objectName: string): Promise<{ size: number; contentType: string }> {
  const stat = await minioClient.statObject(bucket, objectName);
  return {
    size: stat.size,
    contentType: stat.metaData?.["content-type"] || "video/mp4",
  };
}
