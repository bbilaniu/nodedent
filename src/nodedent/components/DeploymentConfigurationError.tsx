import React from "react";

export function DeploymentConfigurationError() {
  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-2xl place-items-center">
        <section role="alert" className="w-full rounded-3xl border border-red-300 bg-white p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-800">Vault access blocked</p>
          <h1 className="mt-2 text-2xl font-bold">Deployment origin does not match this build</h1>
          <p className="mt-3 text-sm leading-6 text-brand-slate">
            This Current or Beta artifact is being served from an unapproved origin. No protected vault was opened. Close this tab and use the clinic's approved NodeDent address, or contact the deployment operator.
          </p>
        </section>
      </div>
    </main>
  );
}
