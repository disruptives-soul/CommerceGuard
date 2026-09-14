import { runScheduledJourney } from "../serverless/runScheduledJourney.js";

const result = await runScheduledJourney();
console.log(JSON.stringify(result, null, 2));
