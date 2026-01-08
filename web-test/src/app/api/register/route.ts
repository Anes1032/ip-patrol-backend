import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/minio";
import { sendCeleryTask } from "@/lib/celery";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const objectKey = `base/${uuidv4()}_${file.name}`;

    await uploadVideo(buffer, objectKey);

    const taskId = await sendCeleryTask("tasks.register.register_video", [objectKey, file.name]);

    return NextResponse.json({ taskId, objectKey });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Failed to register video" }, { status: 500 });
  }
}
