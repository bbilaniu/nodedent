export type DifficultyFlag = "none" | "caution" | "high" | "refer";

export type CanalStatus =
  | "notStarted"
  | "estimated"
  | "scouted"
  | "wlEstablished"
  | "glidePath"
  | "shaped"
  | "disinfected"
  | "complete"
  | "paused"
  | "medicated"
  | "referred";

export type RadiographStatus = "" | "acceptable" | "short" | "long" | "not taken";

export type PriorCanalStatus =
  | ""
  | "unknown"
  | "accessOnly"
  | "locatedScouted"
  | "wlEstablished"
  | "glidePath"
  | "shaped"
  | "medicatedTemporized"
  | "coneFitVerified"
  | "partiallyObturated";

export type WorkflowDiscipline = "endo" | "operative" | "shared" | (string & {});

export type WorkflowScopeKind =
  | "patient"
  | "visit"
  | "tooth"
  | "canal"
  | "surface"
  | "procedure"
  | "quadrant"
  | "sextant"
  | "archSegment"
  | "custom";

export type WorkflowScope = {
  kind: WorkflowScopeKind;
  patientId?: string;
  visitId?: string;
  procedureId?: string;
  tooth?: string;
  teeth?: string[];
  canal?: string;
  surface?: string;
  surfaces?: string[];
  regionLabel?: string;
  label?: string;
  details?: Record<string, unknown>;
};

export type KnownCapabilityName =
  | "diagnosis.recorded"
  | "radiographs.reviewed"
  | "anesthesia.adequate"
  | "isolation.established"
  | "temporaryClosure.placed"
  | "referral.recommended"
  | "finalRestoration.placed";

export type CapabilityName = KnownCapabilityName | (string & {});

export type CapabilitySatisfaction = {
  name: CapabilityName;
  scope: WorkflowScope;
  sourceEventId?: string;
  workflowId?: string;
  workflowRunId?: string;
  satisfiedAt?: string;
  expiresAt?: string;
  details?: Record<string, unknown>;
};

export type CapabilityRequirement = {
  name: CapabilityName;
  scopeKind?: WorkflowScopeKind;
  message?: string;
  allowReassessment?: boolean;
};

export type WorkflowModuleCall = {
  workflowId: string;
  title: string;
  reason?: string;
  scope?: WorkflowScope;
  requiredCapabilities?: CapabilityRequirement[];
  returnedCapabilities?: CapabilityName[];
};

export type ClinicalNode = ProtocolNode & {
  workflowId?: string;
  capabilityRequirements?: CapabilityRequirement[];
  moduleCalls?: WorkflowModuleCall[];
};

export type WorkflowDefinition<NodeType extends ClinicalNode = ClinicalNode> = {
  workflowId: string;
  version: string;
  discipline: WorkflowDiscipline;
  title: string;
  entryNodeIds: string[];
  completionNodeIds: string[];
  supportedScopes: WorkflowScopeKind[];
  nodes: Record<string, NodeType>;
};

export type ClinicalEvent = {
  id: string;
  timestamp: string;
  type: string;
  workflowId?: string;
  workflowVersion?: string;
  workflowRunId?: string;
  parentWorkflowRunId?: string | null;
  nodeId?: string;
  scope?: WorkflowScope;
  capabilitiesSatisfied?: CapabilitySatisfaction[];
  expiresAt?: string;
  tooth?: string;
  canal?: string;
  details?: Record<string, any>;
};

export type ClosureRecord = {
  type: string;
};

export type CanalRecord = {
  name: string;
  priorVisitStatus?: PriorCanalStatus;
  priorVisitNote?: string;
  estimatedWorkingLength?: string;
  fileTerminalLength?: string;
  availableTreatmentSpace?: string;
  referencePoint?: string;
  eal0?: string;
  patencyLength?: string;
  shapingLength?: string;
  wlRadiographStatus?: RadiographStatus;
  finalShape?: string;
  obturationGauge?: string;
  masterCone?: string;
  coneFitRadiograph?: RadiographStatus;
  dryingStatus?: "" | "dry" | "slightly damp" | "wet" | "persistent wet";
  events?: ClinicalEvent[];
  status?: string;
};

export type PriorVisitRecord = {
  continuedFromPriorVisit?: boolean;
  priorVisitDate?: string;
  accessPreviouslyOpened?: boolean;
  temporaryRestorationPresent?: boolean;
  medicationPresent?: "" | "yes" | "no" | "unknown";
  priorRadiographsAvailable?: boolean;
  sourceNote?: string;
};

export type DiagnosisRecord = {
  pulpal?: string;
  apical?: string;
};

export type PreOpRecord = {
  radiographsReviewed?: boolean;
  paReviewed?: boolean;
  bwReviewed?: boolean;
  cbctReviewed?: boolean;
  estimatedChamberDepth?: string;
};

export type EndoCase = {
  patientNumber: string;
  autosavedAt?: string;
  tooth: string;
  procedureType: string;
  caseStatus?: string;
  nextVisitPlan?: string;
  priorVisit?: PriorVisitRecord;
  diagnosis?: DiagnosisRecord;
  difficulty: DifficultyFlag;
  preOp: PreOpRecord;
  currentCanal: string;
  canals: CanalRecord[];
  globalEvents: ClinicalEvent[];
  events?: ClinicalEvent[];
  closure: ClosureRecord | null;
  currentNodeId?: string;
};

export type DecisionGuard =
  | {
      type: "numericComparison";
      scope: "activeCanal" | "case";
      field: string;
      operator: ">" | ">=" | "<" | "<=" | "=";
      value: number;
      message: string;
    }
  | {
      type: "required";
      scope: "activeCanal" | "case";
      field: string;
      message: string;
    }
  | {
      type: "custom";
      id: string;
      message: string;
    };

export type DecisionOption = {
  id?: string;
  label: string;
  nextNodeId: string;
  difficultyFlag?: DifficultyFlag;
  noteEvent?: { type: string };
  guards?: DecisionGuard[];
  moduleCalls?: WorkflowModuleCall[];
};

export type ProtocolNode = {
  id: string;
  phase: string;
  title: string;
  chairsideInstruction: string;
  instruments?: string[];
  materials?: string[];
  requiredInputs?: string[];
  safetyNotes?: string[];
  options: DecisionOption[];
  workflowId?: string;
  capabilityRequirements?: CapabilityRequirement[];
  moduleCalls?: WorkflowModuleCall[];
};

export type CanalContinuationTarget = {
  canalName: string;
  status: CanalStatus;
  label: string;
  phaseLabel?: string;
  nextNodeId: string | null;
  disabled?: boolean;
  reason: string;
};

export type ValidationMessage = {
  optionLabel: string;
  missing: string[];
};

export type CaseSetupFocusTarget = "diagnosis" | "radiographs" | "anesthesia" | "isolation";

export type EmbeddedWorkflowLaunch = {
  workflowId: string;
  entryNodeId?: string;
  workflowRunId: string;
};
