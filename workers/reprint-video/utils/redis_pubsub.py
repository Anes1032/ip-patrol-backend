import json
import redis
from config import REDIS_URL


def get_redis_client() -> redis.Redis:
    return redis.from_url(REDIS_URL)


def publish_status(task_id: str, data: dict) -> None:
    client = get_redis_client()
    channel = f"task:status:{task_id}"
    client.publish(channel, json.dumps(data))


def publish_video_status(video_id: str, data: dict) -> None:
    client = get_redis_client()
    channel = f"video:status:{video_id}"
    client.publish(channel, json.dumps(data))
