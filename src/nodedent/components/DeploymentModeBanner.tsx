import React from "react";
import {
  deploymentIdentity,
  deploymentModeLabel,
  type DeploymentIdentity,
} from "../deploymentMode";
import { cx, semanticStatusTone } from "./uiStyles";

export function DeploymentModeBanner({ identity = deploymentIdentity }: { identity?: DeploymentIdentity }) {
  if (identity.mode === "current") return null;

  return (
    <aside
      aria-label="Deployment mode"
      className={cx("sticky top-0 z-50 border-b px-4 py-2 text-center text-sm font-bold", semanticStatusTone.attention)}
    >
      {identity.mode === "beta"
        ? "Beta — pre-release clinical workspace"
        : `${deploymentModeLabel(identity)} — synthetic data only`}
    </aside>
  );
}
