import type { JourneyResult, ProductStatus } from "../types.js";

export type NotificationMode = "stdout" | "webhook" | "off";

export interface NotificationConfig {
  mode: NotificationMode;
  webhookUrlEnv?: string;
  format?: "json" | "slack";
}

export interface NotificationEvent {
  type: "alert" | "recovery";
  projectId?: string;
  jobId: string;
  productStatus: ProductStatus;
  reason: string;
  runDir: string;
  failedStep?: string;
  result: Pick<JourneyResult, "journeyId" | "status" | "productStatus" | "durationMs" | "currentUrl" | "selectedVehicle">;
}

export async function notify(config: NotificationConfig | undefined, event: NotificationEvent): Promise<boolean> {
  if (!config || config.mode === "off") {
    return false;
  }

  if (config.mode === "stdout") {
    console.log(`[notification:${event.type}] ${event.projectId ?? "-"} ${event.jobId} ${event.productStatus}: ${event.reason}`);
    console.log(`  evidence: ${event.runDir}`);
    return true;
  }

  const webhookUrl = config.webhookUrlEnv ? process.env[config.webhookUrlEnv] : undefined;
  if (!webhookUrl) {
    console.warn(`Notification skipped: webhook env ${config.webhookUrlEnv ?? "(missing)"} is not set`);
    return false;
  }

  const payload = config.format === "slack" ? toSlackPayload(event) : event;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.warn(`Notification webhook returned ${response.status}`);
    return false;
  }

  return true;
}

function toSlackPayload(event: NotificationEvent): { text: string; blocks: unknown[] } {
  const icon = event.type === "recovery" ? ":white_check_mark:" : ":warning:";
  const title = event.type === "recovery" ? "CommerceGuard recovery" : "CommerceGuard alert";
  const vehicle = event.result.selectedVehicle?.name ?? event.result.selectedVehicle?.url ?? "-";
  const text = `${title}: ${event.projectId ?? "-"} / ${event.jobId} / ${event.productStatus}`;

  return {
    text,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${icon} ${title}`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Project*\n${escapeSlack(event.projectId ?? "-")}` },
          { type: "mrkdwn", text: `*Job*\n${escapeSlack(event.jobId)}` },
          { type: "mrkdwn", text: `*Product status*\n${event.productStatus}` },
          { type: "mrkdwn", text: `*Technical status*\n${event.result.status}` },
          { type: "mrkdwn", text: `*Failed step*\n${escapeSlack(event.failedStep ?? "-")}` },
          { type: "mrkdwn", text: `*Duration*\n${event.result.durationMs} ms` }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Reason*\n${escapeSlack(event.reason)}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Vehicle*\n${escapeSlack(vehicle)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Evidence: \`${escapeSlack(event.runDir)}\``
          }
        ]
      }
    ]
  };
}

function escapeSlack(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\s+/g, " ")
    .slice(0, 2000);
}
