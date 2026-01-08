"use client";

import { useState } from "react";

type TaskResult = {
  taskId: string;
  type: "register" | "verify";
  status: string;
  data?: Record<string, unknown>;
};

type Props = {
  results: TaskResult[];
  sessionId?: string | null;
};

export default function ResultDisplay({ results, sessionId }: Props) {
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No results yet</p>
      </div>
    );
  }

  const getVideoId = (data: Record<string, unknown>): string | null => {
    return typeof data.video_id === "string" ? data.video_id : null;
  };

  const getFrameCount = (data: Record<string, unknown>): number | null => {
    return typeof data.frame_count === "number" ? data.frame_count : null;
  };

  const getImageSimilarity = (data: Record<string, unknown>): number | null => {
    return typeof data.image_similarity === "number" ? data.image_similarity : null;
  };

  const getAudioSimilarity = (data: Record<string, unknown>): number | null => {
    return typeof data.audio_similarity === "number" ? data.audio_similarity : null;
  };

  const getMessage = (data: Record<string, unknown>): string | null => {
    return typeof data.message === "string" ? data.message : null;
  };

  const getChunkIndex = (data: Record<string, unknown>): number | null => {
    return typeof data.chunk_index === "number" ? data.chunk_index : null;
  };

  const getTotalChunks = (data: Record<string, unknown>): number | null => {
    return typeof data.total_chunks === "number" ? data.total_chunks : null;
  };

  const getChunkStartTime = (data: Record<string, unknown>): number | null => {
    return typeof data.chunk_start_time === "number" ? data.chunk_start_time : null;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSimilarityColor = (value: number): string => {
    if (value >= 0.8) return "text-green-400";
    if (value >= 0.5) return "text-yellow-400";
    return "text-red-400";
  };

  const getSimilarityBg = (value: number): string => {
    if (value >= 0.8) return "bg-green-500";
    if (value >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const toggleChunkVideo = (chunkIndex: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(chunkIndex)) {
        next.delete(chunkIndex);
      } else {
        next.add(chunkIndex);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {results.map((result, index) => {
        const videoId = result.data ? getVideoId(result.data) : null;
        const frameCount = result.data ? getFrameCount(result.data) : null;
        const imageSim = result.data ? getImageSimilarity(result.data) : null;
        const audioSim = result.data ? getAudioSimilarity(result.data) : null;
        const message = result.data ? getMessage(result.data) : null;
        const chunkIndex = result.data ? getChunkIndex(result.data) : null;
        const totalChunks = result.data ? getTotalChunks(result.data) : null;
        const chunkStartTime = result.data ? getChunkStartTime(result.data) : null;

        const isChunk = chunkIndex !== null && totalChunks !== null && totalChunks > 1;
        const isExpanded = chunkIndex !== null && expandedChunks.has(chunkIndex);
        const chunkVideoUrl = sessionId && chunkIndex !== null ? `/api/chunk/${sessionId}/${chunkIndex}` : null;

        return (
          <div
            key={result.taskId + index}
            className={`rounded-xl p-4 border ${
              result.status === "failed"
                ? "bg-red-500/10 border-red-500/30"
                : result.status === "completed"
                ? "bg-green-500/10 border-green-500/30"
                : "bg-yellow-500/10 border-yellow-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  result.type === "register" ? "bg-purple-500" : "bg-blue-500"
                }`}>
                  {result.type === "register" ? (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-white font-medium">
                    {result.type === "register" ? "Registration" : "Verification"}
                  </span>
                  {isChunk && (
                    <span className="text-gray-400 text-sm ml-2">
                      Chunk {chunkIndex + 1}/{totalChunks}
                      {chunkStartTime !== null && (
                        <span className="text-gray-500 ml-1">
                          ({formatTime(chunkStartTime)})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                result.status === "completed"
                  ? "bg-green-500/20 text-green-400"
                  : result.status === "failed"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {result.status === "processing" && (
                  <svg className="animate-spin w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {result.status}
              </span>
            </div>

            {result.data && (
              <div className="space-y-2 text-sm">
                {result.type === "register" && videoId && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500">Video ID:</span>
                    <code className="bg-black/30 px-2 py-0.5 rounded text-xs">{videoId}</code>
                  </div>
                )}
                {frameCount !== null && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500">Frames:</span>
                    <span>{frameCount}</span>
                  </div>
                )}
                {result.type === "verify" && (imageSim !== null || audioSim !== null) && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {imageSim !== null && (
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">Image Similarity</div>
                        <div className={`text-2xl font-bold ${getSimilarityColor(imageSim)}`}>
                          {(imageSim * 100).toFixed(1)}%
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                          <div
                            className={`h-1.5 rounded-full ${getSimilarityBg(imageSim)}`}
                            style={{ width: `${imageSim * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {audioSim !== null && (
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">Audio Similarity</div>
                        <div className={`text-2xl font-bold ${getSimilarityColor(audioSim)}`}>
                          {(audioSim * 100).toFixed(1)}%
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                          <div
                            className={`h-1.5 rounded-full ${getSimilarityBg(audioSim)}`}
                            style={{ width: `${audioSim * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {result.type === "verify" && chunkVideoUrl && result.status === "completed" && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleChunkVideo(chunkIndex!)}
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {isExpanded ? "Hide video" : "Show video chunk"}
                    </button>
                    {isExpanded && (
                      <div className="mt-3 rounded-lg overflow-hidden bg-black">
                        <video
                          src={chunkVideoUrl}
                          controls
                          className="w-full aspect-video"
                          preload="metadata"
                        />
                      </div>
                    )}
                  </div>
                )}

                {message && (
                  <div className="text-red-400 mt-2">
                    <span className="font-medium">Error:</span> {message}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
