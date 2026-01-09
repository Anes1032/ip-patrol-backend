"use client";

import { useState, useEffect, useCallback } from "react";

type VerifyChunk = {
  chunkIndex: number;
  startTime: number;
  imageSimilarity: number | null;
  audioSimilarity: number | null;
  status: string;
};

type VerifySession = {
  type: "verify";
  sessionId: string;
  queryFilename: string;
  status: string;
  completedChunks: number;
  totalChunks: number;
  avgImageSimilarity: number | null;
  avgAudioSimilarity: number | null;
  createdAt: string;
  chunks: VerifyChunk[];
};

type BaseVideo = {
  id: string;
  filename: string;
  status: string;
  completedChunks: number;
  totalChunks: number;
  durationSeconds: number | null;
  frameCount: number | null;
  createdAt: string;
};

type JobsData = {
  baseVideo: BaseVideo | null;
  verifySessions: VerifySession[];
};

type Props = {
  videoId: string;
  refreshTrigger: number;
};

export default function JobList({ videoId, refreshTrigger }: Props) {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${videoId}`);
      if (response.ok) {
        const jobsData = await response.json();
        setData(jobsData);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, refreshTrigger]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/jobs/stream/${videoId}`);

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === "timeout") {
          eventSource.close();
          return;
        }
        fetchJobs();
      } catch {
        // ignore
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(() => {
        fetchJobs();
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [videoId, fetchJobs]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const toggleChunkVideo = (sessionId: string, chunkIndex: number) => {
    const key = `${sessionId}-${chunkIndex}`;
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSimilarityColor = (value: number | null) => {
    if (value === null) return "text-gray-500";
    if (value >= 0.8) return "text-green-400";
    if (value >= 0.5) return "text-yellow-400";
    return "text-red-400";
  };

  const getSimilarityBg = (value: number | null) => {
    if (value === null) return "bg-gray-700";
    if (value >= 0.8) return "bg-green-500";
    if (value >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-500/20 text-green-400",
      processing: "bg-yellow-500/20 text-yellow-400",
      pending: "bg-gray-500/20 text-gray-400",
      failed: "bg-red-500/20 text-red-400",
    };
    return colors[status] || colors.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Failed to load jobs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.baseVideo && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <span className="text-white font-medium">Base Video Registration</span>
                <p className="text-sm text-gray-400 truncate max-w-xs">{data.baseVideo.filename}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(data.baseVideo.status)}`}>
              {data.baseVideo.status === "processing" && (
                <svg className="animate-spin w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {data.baseVideo.status}
            </span>
          </div>

          {data.baseVideo.status === "processing" && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Registration progress</span>
                <span>{data.baseVideo.completedChunks}/{data.baseVideo.totalChunks}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(data.baseVideo.completedChunks / data.baseVideo.totalChunks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {data.baseVideo.status === "completed" && (
            <div className="mt-3 flex gap-4 text-sm text-gray-400">
              {data.baseVideo.durationSeconds && (
                <span>{formatTime(data.baseVideo.durationSeconds)}</span>
              )}
              {data.baseVideo.frameCount && (
                <span>{data.baseVideo.frameCount} frames</span>
              )}
            </div>
          )}
        </div>
      )}

      {data.verifySessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm text-gray-400 font-medium">Verification Sessions</h3>
          {data.verifySessions.map((session) => (
            <div key={session.sessionId} className="bg-blue-500/10 border border-blue-500/30 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSession(session.sessionId)}
                className="w-full p-4 text-left hover:bg-blue-500/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-white font-medium truncate block max-w-xs">
                        {session.queryFilename}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(session.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {session.status === "completed" && session.avgImageSimilarity !== null && (
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getSimilarityColor(session.avgImageSimilarity)}`}>
                          {((session.avgImageSimilarity || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">avg similarity</div>
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(session.status)}`}>
                      {session.status === "processing" && (
                        <>
                          <svg className="animate-spin w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {session.completedChunks}/{session.totalChunks}
                        </>
                      )}
                      {session.status !== "processing" && session.status}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedSessions.has(session.sessionId) ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {session.status === "processing" && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${(session.completedChunks / session.totalChunks) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>

              {expandedSessions.has(session.sessionId) && session.chunks.length > 0 && (
                <div className="border-t border-blue-500/20 p-4 space-y-2">
                  {session.chunks.map((chunk) => {
                    const chunkKey = `${session.sessionId}-${chunk.chunkIndex}`;
                    const isChunkExpanded = expandedChunks.has(chunkKey);
                    const chunkVideoUrl = `/api/chunk/${session.sessionId}/${chunk.chunkIndex}`;

                    return (
                      <div key={chunk.chunkIndex} className="rounded-lg bg-black/20 overflow-hidden">
                        <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">
                              Chunk {chunk.chunkIndex + 1}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTime(chunk.startTime)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            {chunk.status === "completed" && (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Image:</span>
                                  <span className={`text-sm font-medium ${getSimilarityColor(chunk.imageSimilarity)}`}>
                                    {chunk.imageSimilarity !== null
                                      ? `${(chunk.imageSimilarity * 100).toFixed(1)}%`
                                      : "--"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Audio:</span>
                                  <span className={`text-sm font-medium ${getSimilarityColor(chunk.audioSimilarity)}`}>
                                    {chunk.audioSimilarity !== null
                                      ? `${(chunk.audioSimilarity * 100).toFixed(1)}%`
                                      : "--"}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleChunkVideo(session.sessionId, chunk.chunkIndex);
                                  }}
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                                >
                                  <svg className={`w-3 h-3 transition-transform ${isChunkExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  {isChunkExpanded ? "Hide" : "Video"}
                                </button>
                              </>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(chunk.status)}`}>
                              {chunk.status === "pending" && "waiting"}
                              {chunk.status === "processing" && (
                                <svg className="animate-spin w-3 h-3 inline" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              )}
                              {chunk.status === "completed" && "done"}
                              {chunk.status === "failed" && "failed"}
                            </span>
                          </div>
                        </div>
                        {isChunkExpanded && chunk.status === "completed" && (
                          <div className="p-2 pt-0">
                            <video
                              src={chunkVideoUrl}
                              controls
                              className="w-full aspect-video rounded bg-black"
                              preload="metadata"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data.verifySessions.length === 0 && data.baseVideo?.status === "completed" && (
        <div className="text-center py-6 text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No verification sessions yet</p>
          <p className="text-xs mt-1">Drop videos above to start verification</p>
        </div>
      )}
    </div>
  );
}
