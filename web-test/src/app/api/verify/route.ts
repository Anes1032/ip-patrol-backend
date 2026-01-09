import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/minio";
import { sendCeleryTask } from "@/lib/celery";
import { splitVideoIntoChunks, cleanupChunks, ChunkInfo } from "@/lib/video";
import { createVerifySession, createVerifyChunk } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function POST(request: NextRequest) {
  let tempVideoPath: string | null = null;
  let chunks: ChunkInfo[] = [];

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const baseVideoId = formData.get("baseVideoId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!baseVideoId) {
      return NextResponse.json({ error: "No base video ID provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-"));
    tempVideoPath = path.join(tempDir, file.name);
    fs.writeFileSync(tempVideoPath, buffer);

    chunks = await splitVideoIntoChunks(tempVideoPath);

    const sessionId = uuidv4();

    await createVerifySession(sessionId, baseVideoId, file.name, chunks.length);

    const taskIds: string[] = [];

    for (const chunk of chunks) {
      await createVerifyChunk(sessionId, chunk.index, chunk.startTime);

      const chunkBuffer = fs.readFileSync(chunk.path);
      const objectKey = `verify/${sessionId}/chunk_${chunk.index}.mp4`;

      await uploadVideo(chunkBuffer, objectKey);

      const taskId = await sendCeleryTask("tasks.verify.verify_video", [
        objectKey,
        sessionId,
        baseVideoId,
        chunk.index,
        chunk.startTime,
        chunks.length,
      ]);

      taskIds.push(taskId);
    }

    return NextResponse.json({
      sessionId,
      taskIds,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ error: "Failed to start verification" }, { status: 500 });
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
