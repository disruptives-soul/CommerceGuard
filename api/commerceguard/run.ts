import type { IncomingMessage, ServerResponse } from "node:http";
import { runScheduledJourney } from "../../src/serverless/runScheduledJourney.js";

export const config = {
  maxDuration: 300
};

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;
  const explicitSecret = request.headers["x-cron-secret"];

  if (cronSecret && authorization !== `Bearer ${cronSecret}` && explicitSecret !== cronSecret) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const result = await runScheduledJourney(process.env.CG_SCHEDULER_CONFIG ?? "configs/scheduler.car-one.staging.slack.json");
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body, null, 2));
}
