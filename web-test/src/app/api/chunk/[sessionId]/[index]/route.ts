import { NextRequest, NextResponse } from "next/server";
import { getObjectStream, getObjectStat } from "@/lib/minio";

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string; index: string } }
) {
  try {
    const { sessionId, index } = params;
    const objectKey = `verify/${sessionId}/chunk_${index}.mp4`;

    const stat = await getObjectStat(objectKey);
    const stream = await getObjectStream(objectKey);

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream as AsyncIterable<Buffer>) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Chunk fetch error:", error);
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }
}
