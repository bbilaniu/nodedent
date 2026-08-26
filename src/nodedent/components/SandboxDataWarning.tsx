import React from "react";
import { deploymentIdentity, type DeploymentIdentity } from "../deploymentMode";
import { cx, semanticStatusSurface } from "./uiStyles";

export function SandboxDataWarning({
  identity = deploymentIdentity,
  className = "",
}: {
  identity?: DeploymentIdentity;
  className?: string;
}) {
  if (identity.mode !== "sandbox") return null;

  return (
    <div role="note" className={cx(semanticStatusSurface.attention, "px-4 py-3 text-sm leading-6", className)}>
      <strong>Sandbox — synthetic data only.</strong> Do not enter or import real patient or clinic data. This branch origin has separate, disposable browser storage that may become unavailable after branch deletion, an origin change, or browser cleanup.
    </div>
  );
}
