import { NextRequest } from "next/server";
import Redis from "ioredis";

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const videoId = params.videoId;
  const redisUrl = process.env.REDIS_URL || "redis://redis:6379/0";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const client = new Redis(redisUrl);
      const channel = `video:status:${videoId}`;
      let isClosed = false;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        client.unsubscribe(channel).catch(() => {});
        client.quit().catch(() => {});
      };

      const safeClose = () => {
        if (isClosed) return;
        cleanup();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const sendEvent = (data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          cleanup();
        }
      };

      await client.subscribe(channel);

      client.on("message", (_ch, message) => {
        sendEvent(message);
      });

      const timeout = setTimeout(() => {
        sendEvent(JSON.stringify({ type: "timeout", status: "timeout" }));
        safeClose();
      }, 600000);

      request.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
