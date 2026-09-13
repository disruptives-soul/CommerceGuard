export type ResultStatus =
  | "PASS"
  | "JOURNEY_FAILURE"
  | "TIMEOUT"
  | "AUTOMATION_BLOCKED"
  | "NETWORK_FAILURE"
  | "UNEXPECTED_STATE"
  | "EXTERNAL_SERVICE_FAILURE";

export type StepAction =
  | "goto"
  | "click"
  | "fill"
  | "waitForSelector"
  | "assertText"
  | "assertUrl"
  | "screenshot";

export type Assertion =
  | {
      type: "urlContains" | "textContains" | "notTextContains";
      value: string;
    }
  | {
      type: "selectorVisible";
      selector: string;
    };

export interface JourneyStep {
  id: string;
  action: StepAction;
  url?: string;
  selector?: string;
  value?: string;
  name?: string;
  assertions?: Assertion[];
}

export interface JourneyConfig {
  id: string;
  name: string;
  baseUrl: string;
  stopBeforeIrreversibleAction: boolean;
  retry?: {
    attempts: number;
    delayMs: number;
  };
  timeouts?: {
    navigationMs: number;
    stepMs: number;
  };
  steps: JourneyStep[];
}

export interface EvidenceEvent {
  type: "console" | "pageerror" | "requestfailed";
  message: string;
  url?: string;
  timestamp: string;
}

export interface StepResult {
  id: string;
  action: StepAction;
  status: "PASS" | "FAIL";
  durationMs: number;
  error?: string;
  screenshot?: string;
}

export interface JourneyResult {
  journeyId: string;
  journeyName: string;
  status: ResultStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  attempts: number;
  runDir: string;
  steps: StepResult[];
  evidence: EvidenceEvent[];
  error?: string;
}
