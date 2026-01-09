import { Pool } from "pg";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "postgres",
  database: process.env.POSTGRES_DB || "ip_patrol",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
  port: 5432,
  max: 10,
});

export async function createBaseVideoChunked(
  videoId: string,
  filename: string,
  objectKey: string,
  totalChunks: number
): Promise<void> {
  await pool.query(
    `INSERT INTO base_videos (id, filename, object_key, total_chunks, completed_chunks, status)
     VALUES ($1, $2, $3, $4, 0, 'processing')`,
    [videoId, filename, objectKey, totalChunks]
  );
}

export async function createRegisterChunk(
  videoId: string,
  chunkIndex: number,
  startTime: number,
  duration: number
): Promise<void> {
  await pool.query(
    `INSERT INTO register_chunks (video_id, chunk_index, start_time, duration, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [videoId, chunkIndex, startTime, duration]
  );
}

export async function getBaseVideoStatus(videoId: string): Promise<{
  status: string;
  completedChunks: number;
  totalChunks: number;
} | null> {
  const result = await pool.query(
    `SELECT status, completed_chunks, total_chunks FROM base_videos WHERE id = $1`,
    [videoId]
  );
  if (result.rows.length === 0) return null;
  return {
    status: result.rows[0].status,
    completedChunks: result.rows[0].completed_chunks,
    totalChunks: result.rows[0].total_chunks,
  };
}

export async function getBaseVideos(): Promise<Array<{
  id: string;
  filename: string;
  status: string;
  durationSeconds: number | null;
  frameCount: number | null;
  completedChunks: number;
  totalChunks: number;
  createdAt: Date;
}>> {
  const result = await pool.query(
    `SELECT id, filename, status, duration_seconds, frame_count,
            completed_chunks, total_chunks, created_at
     FROM base_videos
     ORDER BY created_at DESC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    status: row.status,
    durationSeconds: row.duration_seconds,
    frameCount: row.frame_count,
    completedChunks: row.completed_chunks || 0,
    totalChunks: row.total_chunks || 1,
    createdAt: row.created_at,
  }));
}

export async function createVerifySession(
  sessionId: string,
  baseVideoId: string,
  queryFilename: string,
  totalChunks: number
): Promise<void> {
  await pool.query(
    `INSERT INTO verify_sessions (id, base_video_id, query_filename, total_chunks, completed_chunks, status)
     VALUES ($1, $2, $3, $4, 0, 'processing')`,
    [sessionId, baseVideoId, queryFilename, totalChunks]
  );
}

export async function createVerifyChunk(
  sessionId: string,
  chunkIndex: number,
  startTime: number
): Promise<void> {
  await pool.query(
    `INSERT INTO verify_chunks (session_id, chunk_index, start_time, status)
     VALUES ($1, $2, $3, 'pending')`,
    [sessionId, chunkIndex, startTime]
  );
}

export type RegisterJob = {
  type: "register";
  videoId: string;
  filename: string;
  status: string;
  completedChunks: number;
  totalChunks: number;
  createdAt: Date;
};

export type VerifyJob = {
  type: "verify";
  sessionId: string;
  queryFilename: string;
  status: string;
  completedChunks: number;
  totalChunks: number;
  avgImageSimilarity: number | null;
  avgAudioSimilarity: number | null;
  createdAt: Date;
  chunks: Array<{
    chunkIndex: number;
    startTime: number;
    imageSimilarity: number | null;
    audioSimilarity: number | null;
    status: string;
  }>;
};

export type JobsResponse = {
  baseVideo: {
    id: string;
    filename: string;
    status: string;
    completedChunks: number;
    totalChunks: number;
    durationSeconds: number | null;
    frameCount: number | null;
    createdAt: Date;
  } | null;
  verifySessions: VerifyJob[];
};

export async function getJobsForVideo(videoId: string): Promise<JobsResponse> {
  const baseVideoResult = await pool.query(
    `SELECT id, filename, status, completed_chunks, total_chunks,
            duration_seconds, frame_count, created_at
     FROM base_videos WHERE id = $1`,
    [videoId]
  );

  const baseVideo = baseVideoResult.rows.length > 0 ? {
    id: baseVideoResult.rows[0].id,
    filename: baseVideoResult.rows[0].filename,
    status: baseVideoResult.rows[0].status,
    completedChunks: baseVideoResult.rows[0].completed_chunks || 0,
    totalChunks: baseVideoResult.rows[0].total_chunks || 1,
    durationSeconds: baseVideoResult.rows[0].duration_seconds,
    frameCount: baseVideoResult.rows[0].frame_count,
    createdAt: baseVideoResult.rows[0].created_at,
  } : null;

  const sessionsResult = await pool.query(
    `SELECT id, query_filename, status, completed_chunks, total_chunks, created_at
     FROM verify_sessions
     WHERE base_video_id = $1
     ORDER BY created_at DESC`,
    [videoId]
  );

  const verifySessions: VerifyJob[] = [];

  for (const session of sessionsResult.rows) {
    const chunksResult = await pool.query(
      `SELECT chunk_index, start_time, image_similarity, audio_similarity, status
       FROM verify_chunks
       WHERE session_id = $1
       ORDER BY chunk_index`,
      [session.id]
    );

    const chunks = chunksResult.rows.map((row) => ({
      chunkIndex: row.chunk_index,
      startTime: row.start_time,
      imageSimilarity: row.image_similarity,
      audioSimilarity: row.audio_similarity,
      status: row.status,
    }));

    const completedChunks = chunks.filter(c => c.status === "completed");
    const avgImageSimilarity = completedChunks.length > 0
      ? completedChunks.reduce((sum, c) => sum + (c.imageSimilarity || 0), 0) / completedChunks.length
      : null;
    const avgAudioSimilarity = completedChunks.length > 0
      ? completedChunks.reduce((sum, c) => sum + (c.audioSimilarity || 0), 0) / completedChunks.length
      : null;

    verifySessions.push({
      type: "verify",
      sessionId: session.id,
      queryFilename: session.query_filename,
      status: session.status,
      completedChunks: session.completed_chunks || 0,
      totalChunks: session.total_chunks,
      avgImageSimilarity,
      avgAudioSimilarity,
      createdAt: session.created_at,
      chunks,
    });
  }

  return { baseVideo, verifySessions };
}
