import { notify } from "../notifications/notify.js";

async function main(): Promise<void> {
  const webhookUrlEnv = process.env.CG_WEBHOOK_URL ? "CG_WEBHOOK_URL" : undefined;

  if (!webhookUrlEnv) {
    throw new Error("CG_WEBHOOK_URL is not set. Set it locally or in Vercel before running this test.");
  }

  const sent = await notify(
    {
      mode: "webhook",
      format: "slack",
      webhookUrlEnv
    },
    {
      type: "alert",
      projectId: "car-one",
      jobId: "slack-webhook-smoke-test",
      productStatus: "MONITOR_FAILURE",
      reason: "Slack webhook smoke test from CommerceGuard.",
      runDir: "local-smoke-test",
      failedStep: "notify:test-slack",
      result: {
        journeyId: "slack-webhook-smoke-test",
        status: "UNEXPECTED_STATE",
        productStatus: "MONITOR_FAILURE",
        durationMs: 0,
        currentUrl: "local",
        selectedVehicle: {
          name: "CommerceGuard Slack Test"
        }
      }
    }
  );

  if (!sent) {
    throw new Error("Slack notification was not sent. Check CG_WEBHOOK_URL and webhook permissions.");
  }

  console.log("Slack test notification sent.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
