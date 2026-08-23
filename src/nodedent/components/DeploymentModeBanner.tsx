import React from "react";
import {
  deploymentIdentity,
  deploymentModeLabel,
  type DeploymentIdentity,
} from "../deploymentMode";

export function DeploymentModeBanner({ identity = deploymentIdentity }: { identity?: DeploymentIdentity }) {
  if (identity.mode === "current") return null;

  const isBeta = identity.mode === "beta";
  return (
    <aside
      aria-label="Deployment mode"
      className={isBeta
        ? "sticky top-0 z-50 border-b border-brand-blue-light bg-brand-navy px-4 py-2 text-center text-sm font-bold text-white"
        : "sticky top-0 z-50 border-b border-amber-400 bg-amber-50 px-4 py-2 text-center text-sm font-bold text-amber-950"}
    >
      {isBeta
        ? "Beta — pre-release clinical workspace"
        : `${deploymentModeLabel(identity)} — synthetic data only`}
    </aside>
  );
}
