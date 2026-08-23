import React from "react";
import { applicationVersion } from "../applicationVersion";
import { deploymentIdentity, deploymentModeLabel, type DeploymentIdentity } from "../deploymentMode";

export const PRIVACY_POLICY_HASH = "#privacy-policy";

export function AppFooter({ identity = deploymentIdentity }: { identity?: DeploymentIdentity }) {
  const shortCommit = identity.commitSha === "unknown" ? "unknown commit" : identity.commitSha.slice(0, 8);
  return (
    <footer className="bg-brand-light-slate px-4 pb-5 pt-2 text-brand-slate">
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-brand-light-node pt-4 text-xs sm:justify-end">
        <span>{deploymentModeLabel(identity)}</span>
        {applicationVersion ? <span aria-label={`NodeDent application version ${applicationVersion}`}>NodeDent v{applicationVersion}</span> : null}
        <span aria-label={`Source commit ${identity.commitSha}`}>{shortCommit}</span>
        <a href={PRIVACY_POLICY_HASH} className="font-semibold underline decoration-brand-light-node underline-offset-4 hover:text-brand-navy focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint">
          Privacy policy
        </a>
      </div>
    </footer>
  );
}
