export type ResultStatus =
  | "PASS"
  | "JOURNEY_FAILURE"
  | "TIMEOUT"
  | "AUTOMATION_BLOCKED"
  | "NETWORK_FAILURE"
  | "UNEXPECTED_STATE"
  | "EXTERNAL_SERVICE_FAILURE";

export type ProductStatus =
  | "PASS"
  | "COMMERCE_FAILURE"
  | "MONITOR_FAILURE"
  | "INCONCLUSIVE";

export type ReportGroup = "real" | "failure-lab";

export type StepAction =
  | "goto"
  | "click"
  | "clickFirst"
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
  clickPosition?: {
    x: number;
    y: number;
  };
  assertions?: Assertion[];
}

export interface JourneyConfig {
  id: string;
  name: string;
  projectId?: string;
  adapter?: string;
  reportGroup?: ReportGroup;
  environment?: string;
  baseUrl: string;
  stopBeforeIrreversibleAction: boolean;
  safeSubmit?: boolean;
  safety?: {
    allowedBaseUrlPrefixes?: string[];
    requiredEnv?: Record<string, string>;
  };
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
  currentUrl?: string;
  error?: string;
  screenshot?: string;
  clickedElement?: {
    text?: string;
    href?: string;
    dataCg?: string;
    sku?: string;
    condition?: string;
    urlKey?: string;
  };
}

export interface JourneyResult {
  journeyId: string;
  journeyName: string;
  projectId?: string;
  adapter?: string;
  reportGroup: ReportGroup;
  environment?: string;
  status: ResultStatus;
  productStatus: ProductStatus;
  reason: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  attempts: number;
  recoveredByRetry: boolean;
  runDir: string;
  steps: StepResult[];
  attemptsDetail?: JourneyAttemptResult[];
  evidence: EvidenceEvent[];
  failedStep?: string;
  currentUrl?: string;
  selectedVehicle?: {
    name?: string;
    url?: string;
    sku?: string;
    condition?: string;
  };
  error?: string;
}

export interface JourneyAttemptResult {
  attempt: number;
  status: ResultStatus;
  productStatus: ProductStatus;
  reason: string;
  durationMs: number;
  steps: StepResult[];
  evidence: EvidenceEvent[];
  failedStep?: string;
  currentUrl?: string;
  selectedVehicle?: {
    name?: string;
    url?: string;
    sku?: string;
    condition?: string;
  };
  error?: string;
}
