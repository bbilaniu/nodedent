import React from "react";
import { applicationVersion } from "../applicationVersion";

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-light-node bg-white p-5">
      <h2 className="text-lg font-bold text-brand-navy">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-brand-slate">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <article aria-labelledby="privacy-policy-title" className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl border border-brand-light-node bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">NodeDent</p>
          <h1 id="privacy-policy-title" className="mt-2 text-3xl font-bold tracking-tight">Privacy policy</h1>
          <p className="mt-3 text-sm leading-6 text-brand-slate">
            Last updated July 22, 2026{applicationVersion ? ` · Applies to NodeDent v${applicationVersion}` : ""}
          </p>
          <p className="mt-3 text-sm leading-6 text-brand-slate">
            This policy describes NodeDent's local clinical workspace. It does not replace the deploying clinic's privacy notice, professional duties, records policy, or jurisdiction-specific assessment.
          </p>
          <a href="#" className="mt-4 inline-flex rounded-xl border border-brand-light-node bg-brand-light-slate px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-light-node focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint">
            Return to NodeDent
          </a>
        </header>

        <PolicySection title="Who is responsible">
          <p>The clinic operating NodeDent controls the patient information entered on its device and remains responsible for access, retention, disclosure, incident response, and responding to privacy requests. Contact the clinic's privacy officer through the clinic's established contact channel for a request or concern involving patient information.</p>
          <p>EMRs such as ClearDent or Dentrix remain the official record. NodeDent is a temporary workflow and note-generation workspace.</p>
        </PolicySection>

        <PolicySection title="Information used by NodeDent">
          <p>After the clinic approves clinical deployment, NodeDent may use a clinic chart number and the minimum clinical facts needed to operate a selected workflow and generate a note.</p>
          <p>Do not enter names, exact dates of birth, addresses, telephone numbers, email addresses, government health numbers, insurance identifiers, or unrelated identifying information. A chart number combined with clinical facts remains identifying health information.</p>
        </PolicySection>

        <PolicySection title="Purpose and official record">
          <p>NodeDent uses the entered information to maintain a temporary chairside workflow, generate clinician-reviewed notes, resume local drafts, and create user-requested backups or exports.</p>
          <p>The clinician must select the correct ClearDent or Dentrix chart, transfer the final plain-text note, review its content, and verify that the EMR saved it. NodeDent does not receive or claim proof of that save.</p>
        </PolicySection>

        <PolicySection title="Local storage and safeguards">
          <p>Clinical cases are stored in an encrypted IndexedDB vault in the clinic browser profile. The vault uses authenticated encryption, and the usable key exists only in memory while unlocked. NodeDent locks explicitly, after inactivity, when hidden or left, and when another tab takes control.</p>
          <p>The display theme and reusable, patient-independent shortcut catalogs may remain in ordinary browser storage. Never put a chart number, patient fact, or identifier into a reusable shortcut.</p>
          <p>Browser storage can be deleted, corrupted, or evicted. The clinic controls device encryption, operating-system accounts, browser extensions, screen locking, backups, retention, and secure deletion.</p>
        </PolicySection>

        <PolicySection title="Transmission, hosting, and telemetry">
          <p>The current NodeDent application does not transmit chart numbers, clinical facts, notes, vault contents, passphrases, clipboard content, or exports to NodeDent, telemetry, analytics, or remote logging services. Its production content security policy blocks application network connections.</p>
          <p>The static hosting service still receives ordinary requests needed to load the application and may process technical information such as an IP address, request time, browser information, and requested static asset. NodeDent does not place patient information in those request URLs.</p>
          <p>A future deployment may enable reviewed operational telemetry that contains no patient data. Before activation, the deployer must document the provider, purpose, technical fields, retention, access, location, and applicable notice or choice; update this policy; and verify that chart numbers, encounter identifiers, clinical content, notes, filenames, passphrases, clipboard content, exports, and vault data are excluded. Technical telemetry may still be personal information even when it is not patient data.</p>
        </PolicySection>

        <PolicySection title="Copies, exports, and legacy data">
          <p>Copied text and downloaded text or JSON are plaintext outside the encrypted vault. Filenames include the chart number and therefore remain identifying. The clinic must use approved destinations and deletion procedures.</p>
          <p>Encrypted <code>.nodedent</code> backups require the original passphrase. Existing prototype localStorage cases are not migrated; NodeDent offers only an explicit raw plaintext backup or confirmed deletion.</p>
        </PolicySection>

        <PolicySection title="Retention, access, correction, and deletion">
          <p>NodeDent does not silently purge cases. The clinic must review and delete temporary cases and backups according to its approved policy after confirming the official EMR record. Deleting NodeDent data does not delete ClearDent or Dentrix records.</p>
          <p>Requests to access or correct the official clinical record must follow the clinic's established process. Local NodeDent cases can be deleted individually, together, or by deleting the entire vault, subject to displayed confirmations.</p>
        </PolicySection>

        <PolicySection title="Limits and incidents">
          <p>Vault encryption protects locked local records at rest. It does not protect an unlocked session from a compromised device, malicious same-origin build, hostile browser extension, screen capture, clipboard access, or misuse by an authorized person.</p>
          <p>If the device, browser profile, passphrase, build, backup, export, or clipboard may be compromised, stop using NodeDent for clinical data and follow the clinic's privacy and security incident process. Do not paste patient data into public issues, support chats, analytics, or remote logs.</p>
        </PolicySection>

        <PolicySection title="Changes and deployment approval">
          <p>This policy must be reviewed when the data fields, hosting, telemetry, storage, retention, supported jurisdiction, or EMR transfer method changes. The clinic must complete its privacy and operational review before using real patient data.</p>
          <p>ADR 0008 remains proposed. This policy and the technical implementation do not by themselves authorize clinical deployment.</p>
        </PolicySection>
      </article>
    </main>
  );
}
