import { NextRequest, NextResponse } from "next/server";
import { getJobsForVideo } from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const videoId = params.videoId;

  try {
    const jobs = await getJobsForVideo(videoId);
    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
