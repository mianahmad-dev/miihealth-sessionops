import { NextResponse } from "next/server";

// This endpoint has been retired. Audio processing now uses /api/voice/text
// which accepts transcribed text from the browser's Web Speech API.
export async function POST() {
  return NextResponse.json({ error: "Endpoint retired. Use /api/voice/text." }, { status: 410 });
}
