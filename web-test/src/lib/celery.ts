import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379/0";

export async function sendCeleryTask(
  taskName: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<string> {
  const client = new Redis(redisUrl);
  const taskId = uuidv4();

  const message = {
    id: taskId,
    task: taskName,
    args,
    kwargs,
    retries: 0,
    eta: null,
    expires: null,
  };

  const body = Buffer.from(JSON.stringify(message)).toString("base64");

  const celeryMessage = JSON.stringify({
    body,
    "content-encoding": "utf-8",
    "content-type": "application/json",
    headers: {
      lang: "py",
      task: taskName,
      id: taskId,
      root_id: taskId,
      parent_id: null,
      group: null,
    },
    properties: {
      correlation_id: taskId,
      reply_to: "",
      delivery_mode: 2,
      delivery_info: {
        exchange: "",
        routing_key: "celery",
      },
      priority: 0,
      body_encoding: "base64",
      delivery_tag: uuidv4(),
    },
  });

  await client.lpush("celery", celeryMessage);
  await client.quit();

  return taskId;
}
