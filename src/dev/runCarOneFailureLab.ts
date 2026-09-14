import { spawn } from "node:child_process";

type ModeExpectation = {
  mode: string;
  expectedStatus?: string;
  expectedProductStatus: string;
};

const modes: ModeExpectation[] = [
  { mode: "NORMAL", expectedStatus: "PASS", expectedProductStatus: "PASS" },
  { mode: "SLOW_RESPONSE", expectedStatus: "PASS", expectedProductStatus: "PASS" },
  { mode: "BROKEN_CTA", expectedStatus: "JOURNEY_FAILURE", expectedProductStatus: "COMMERCE_FAILURE" },
  { mode: "EMPTY_RESULT", expectedStatus: "JOURNEY_FAILURE", expectedProductStatus: "COMMERCE_FAILURE" },
  { mode: "BROKEN_PRICE", expectedStatus: "JOURNEY_FAILURE", expectedProductStatus: "COMMERCE_FAILURE" },
  { mode: "API_500", expectedStatus: "JOURNEY_FAILURE", expectedProductStatus: "COMMERCE_FAILURE" },
  { mode: "JS_EXCEPTION", expectedStatus: "JOURNEY_FAILURE", expectedProductStatus: "COMMERCE_FAILURE" },
  { mode: "API_TIMEOUT", expectedProductStatus: "INCONCLUSIVE" }
];

const recipe = "recipes/car-one.failure-lab-local.json";
const tsxCli = "node_modules/tsx/dist/cli.mjs";

async function main(): Promise<void> {
  console.log(`Starting Car One Failure Lab with ${modes.length} modes`);
  const rows: Array<{ mode: string; expectedStatus: string; expectedProductStatus: string; actualStatus: string; actualProductStatus: string; ok: boolean; runDir?: string }> = [];

  for (const { mode, expectedStatus, expectedProductStatus } of modes) {
    const server = spawn(process.execPath, [tsxCli, "src/dev/carOneMockServer.ts"], {
      env: { ...process.env, CG_MOCK_MODE: mode },
      stdio: ["ignore", "pipe", "pipe"]
    });

    try {
      await waitForServer(server);
      const result = await runRecipe();
      const ok = (!expectedStatus || result.status === expectedStatus) && result.productStatus === expectedProductStatus;
      rows.push({
        mode,
        expectedStatus: expectedStatus ?? "*",
        expectedProductStatus,
        actualStatus: result.status,
        actualProductStatus: result.productStatus,
        ok,
        runDir: result.runDir
      });
      console.log(`${ok ? "PASS" : "FAIL"} ${mode}: expected ${expectedStatus ?? "*"} / ${expectedProductStatus}, got ${result.status} / ${result.productStatus}`);
    } finally {
      const exited = waitForExit(server);
      server.kill("SIGINT");
      await exited;
    }
  }

  const failed = rows.filter((row) => !row.ok);
  console.log("\nFailure Lab summary");
  console.table(rows.map(({ mode, expectedStatus, expectedProductStatus, actualStatus, actualProductStatus, ok }) => ({ mode, expectedStatus, expectedProductStatus, actualStatus, actualProductStatus, ok })));

  if (failed.length > 0) {
    process.exitCode = 2;
  }
}

function waitForServer(server: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for mock server"));
    }, 10_000);

    server.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("Car One local mock listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Mock server exited before ready with code ${code ?? "unknown"}`));
    });
  });
}

function runRecipe(): Promise<{ status: string; productStatus: string; runDir?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, "src/cli.ts", recipe], {
      env: { ...process.env, CARONE_BASE_URL: "http://127.0.0.1:4173" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let errorOutput = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString("utf8");
    });

    child.once("exit", () => {
      const parsed = parseCliJson(output);

      if (parsed) {
        resolve(parsed);
        return;
      }

      reject(new Error(`Could not parse runner output:\n${output}\n${errorOutput}`));
    });
  });
}

function parseCliJson(output: string): { status: string; productStatus: string; runDir?: string } | undefined {
  const start = output.lastIndexOf("{");
  const end = output.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return undefined;
  }

  return JSON.parse(output.slice(start, end + 1)) as { status: string; productStatus: string; runDir?: string };
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
