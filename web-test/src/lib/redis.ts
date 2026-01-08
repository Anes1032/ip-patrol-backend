import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379/0";

export function createRedisClient(): Redis {
  return new Redis(redisUrl);
}

export async function publishTask(
  taskType: string,
  payload: Record<string, unknown>
): Promise<string> {
  const client = createRedisClient();
  const taskId = crypto.randomUUID();

  const message = JSON.stringify({
    id: taskId,
    type: taskType,
    payload,
  });

  await client.lpush("celery", message);
  await client.quit();

  return taskId;
}

export async function subscribeToTask(
  taskId: string,
  onMessage: (data: Record<string, unknown>) => void,
  onClose: () => void
): Promise<() => void> {
  const client = createRedisClient();
  const channel = `task:status:${taskId}`;

  await client.subscribe(channel);

  client.on("message", (_ch, message) => {
    try {
      const data = JSON.parse(message);
      onMessage(data);
      if (data.status === "completed" || data.status === "failed") {
        client.unsubscribe(channel);
        client.quit();
        onClose();
      }
    } catch {
      // ignore parse errors
    }
  });

  return () => {
    client.unsubscribe(channel);
    client.quit();
  };
}
