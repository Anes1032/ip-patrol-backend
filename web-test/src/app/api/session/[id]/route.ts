import { NextRequest } from "next/server";
import Redis from "ioredis";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const searchParams = request.nextUrl.searchParams;
  const taskIdsParam = searchParams.get("taskIds");
  const totalChunks = parseInt(searchParams.get("totalChunks") || "1", 10);

  if (!taskIdsParam) {
    return new Response("Missing taskIds parameter", { status: 400 });
  }

  const taskIds = taskIdsParam.split(",");
  const redisUrl = process.env.REDIS_URL || "redis://redis:6379/0";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const client = new Redis(redisUrl);
      const channels = taskIds.map((id) => `task:status:${id}`);
      let isClosed = false;
      let completedCount = 0;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        for (const channel of channels) {
          client.unsubscribe(channel).catch(() => {});
        }
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

      for (const channel of channels) {
        await client.subscribe(channel);
      }

      client.on("message", (channel, message) => {
        const taskId = channel.replace("task:status:", "");
        try {
          const data = JSON.parse(message);
          sendEvent(JSON.stringify({ ...data, taskId }));

          if (data.status === "completed" || data.status === "failed") {
            completedCount++;
            if (completedCount >= totalChunks) {
              sendEvent(JSON.stringify({ type: "session_complete", sessionId }));
              safeClose();
            }
          }
        } catch {
          sendEvent(message);
        }
      });

      const timeout = setTimeout(() => {
        sendEvent(JSON.stringify({ type: "timeout", status: "timeout", sessionId }));
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
