import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sessions, transcriptEvents } from "@/lib/db/schema";
import { eq, gt, and, asc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastSeqNum = -1;
      let done = false;

      req.signal.addEventListener("abort", () => {
        done = true;
      });

      while (!done) {
        try {
          const events = await db
            .select()
            .from(transcriptEvents)
            .where(
              and(
                eq(transcriptEvents.sessionId, sessionId),
                gt(transcriptEvents.sequenceNum, lastSeqNum)
              )
            )
            .orderBy(asc(transcriptEvents.sequenceNum));

          for (const event of events) {
            controller.enqueue(
              encoder.encode(`event: transcript\ndata: ${JSON.stringify(event)}\n\n`)
            );
            lastSeqNum = event.sequenceNum;
          }

          const session = await db
            .select()
            .from(sessions)
            .where(eq(sessions.id, sessionId))
            .get();

          if (
            session?.status === "completed" ||
            session?.status === "failed" ||
            session?.status === "needs_review"
          ) {
            controller.enqueue(
              encoder.encode(
                `event: end\ndata: ${JSON.stringify({ status: session.status, sessionId })}\n\n`
              )
            );
            done = true;
            controller.close();
            break;
          }
        } catch {
          done = true;
          try { controller.close(); } catch { /* already closed */ }
          break;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
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
