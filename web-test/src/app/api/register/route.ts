import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/minio";
import { sendCeleryTask } from "@/lib/celery";
import { splitVideoIntoChunks, cleanupChunks, ChunkInfo } from "@/lib/video";
import { createBaseVideoChunked, createRegisterChunk } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function POST(request: NextRequest) {
  let tempVideoPath: string | null = null;
  let chunks: ChunkInfo[] = [];

  const videoIdParam = request.nextUrl.searchParams.get("videoId");
  const videoId = videoIdParam || uuidv4();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "register-"));
    tempVideoPath = path.join(tempDir, file.name);
    fs.writeFileSync(tempVideoPath, buffer);

    const objectKey = `base/${videoId}/${file.name}`;
    await uploadVideo(buffer, objectKey);

    chunks = await splitVideoIntoChunks(tempVideoPath);

    await createBaseVideoChunked(videoId, file.name, objectKey, chunks.length);

    const taskIds: string[] = [];

    for (const chunk of chunks) {
      await createRegisterChunk(videoId, chunk.index, chunk.startTime, chunk.duration);

      const chunkBuffer = fs.readFileSync(chunk.path);
      const chunkObjectKey = `base/${videoId}/chunk_${chunk.index}.mp4`;
      await uploadVideo(chunkBuffer, chunkObjectKey);

      const taskId = await sendCeleryTask("tasks.register.register_chunk", [
        chunkObjectKey,
        videoId,
        chunk.index,
        chunk.startTime,
        chunks.length,
      ]);

      taskIds.push(taskId);
    }

    return NextResponse.json({
      videoId,
      taskIds,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Failed to register video" }, { status: 500 });
  } finally {
    cleanupChunks(chunks);
    if (tempVideoPath) {
      try {
        fs.unlinkSync(tempVideoPath);
        fs.rmdirSync(path.dirname(tempVideoPath));
      } catch {
        // ignore
      }
    }
  }
}
