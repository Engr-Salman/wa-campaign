// Worker entrypoint. Run via `npm run worker` in dev or `node dist/...` in prod.
// Starts all BullMQ workers and keeps the process alive.
import "dotenv/config";
import { logger } from "@/lib/logger";
import { startCampaignDispatchWorker } from "./campaign-dispatch.worker";
import { startEmailSendWorker } from "./email-send.worker";
import { startWebhookIngestWorker } from "./webhook-ingest.worker";

async function main() {
  logger.info("starting workers");
  const workers = [
    startCampaignDispatchWorker(),
    startEmailSendWorker(),
    startWebhookIngestWorker(),
  ];

  const shutdown = async (sig: string) => {
    logger.info({ sig }, "shutting down workers");
    await Promise.allSettled(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  logger.error({ err: e }, "worker bootstrap failed");
  process.exit(1);
});
