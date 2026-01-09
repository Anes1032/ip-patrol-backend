import { NextResponse } from "next/server";
import { getBaseVideos } from "@/lib/database";

export async function GET() {
  try {
    const videos = await getBaseVideos();
    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
