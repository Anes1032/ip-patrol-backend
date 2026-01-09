"use client";

import { useState, useEffect } from "react";

type BaseVideo = {
  id: string;
  filename: string;
  status: string;
  durationSeconds: number | null;
  frameCount: number | null;
  completedChunks: number;
  totalChunks: number;
  createdAt: string;
};

type Props = {
  onSelect: (videoId: string) => void;
  onCreate: () => void;
};

export default function ProjectSelector({ onSelect, onCreate }: Props) {
  const [videos, setVideos] = useState<BaseVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch("/api/videos");
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400";
      case "processing":
        return "bg-yellow-500/20 text-yellow-400";
      case "failed":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onCreate}
        className="w-full py-4 px-6 rounded-xl border-2 border-dashed border-purple-500/50 hover:border-purple-400 hover:bg-purple-500/10 transition-all flex items-center justify-center gap-3 text-purple-300 hover:text-purple-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="font-medium">New Registration</span>
      </button>

      {videos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm text-gray-400 font-medium px-1">Recent Projects</h3>
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => onSelect(video.id)}
              className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium truncate flex-1 mr-2">
                  {video.filename}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                  {video.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDuration(video.durationSeconds)}
                </span>
                {video.frameCount && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {video.frameCount} frames
                  </span>
                )}
                {video.status === "processing" && (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {video.completedChunks}/{video.totalChunks}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {new Date(video.createdAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}

      {videos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <p>No registered videos yet</p>
        </div>
      )}
    </div>
  );
}
