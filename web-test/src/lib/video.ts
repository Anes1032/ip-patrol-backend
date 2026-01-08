import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CHUNK_DURATION = parseInt(process.env.CHUNK_DURATION_SECONDS || "60", 10);

export type ChunkInfo = {
  index: number;
  path: string;
  startTime: number;
  duration: number;
};

export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()));
      } else {
        reject(new Error("Failed to get video duration"));
      }
    });
  });
}

export async function splitVideoIntoChunks(videoPath: string): Promise<ChunkInfo[]> {
  const duration = await getVideoDuration(videoPath);
  const numChunks = Math.ceil(duration / CHUNK_DURATION);
  const chunks: ChunkInfo[] = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-chunks-"));

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION;
    const chunkDuration = Math.min(CHUNK_DURATION, duration - startTime);
    const chunkPath = path.join(tempDir, `chunk_${i}.mp4`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", videoPath,
        "-ss", startTime.toString(),
        "-t", chunkDuration.toString(),
        "-c", "copy",
        "-y",
        chunkPath,
      ]);

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to create chunk ${i}`));
        }
      });
    });

    chunks.push({
      index: i,
      path: chunkPath,
      startTime,
      duration: chunkDuration,
    });
  }

  return chunks;
}

export function cleanupChunks(chunks: ChunkInfo[]): void {
  if (chunks.length === 0) return;

  const tempDir = path.dirname(chunks[0].path);
  for (const chunk of chunks) {
    try {
      fs.unlinkSync(chunk.path);
    } catch {
      // ignore
    }
  }
  try {
    fs.rmdirSync(tempDir);
  } catch {
    // ignore
  }
}
