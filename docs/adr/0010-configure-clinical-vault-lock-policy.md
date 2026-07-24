# ADR 0010: Configure Clinical Vault Lock Policy Within Guardrails

## Status

Proposed

## Context

NodeDent's protected clinical vault currently locks after 15 minutes without a
pointer, keyboard, or touch interaction. It also locks when the page becomes
hidden, when the user leaves the page, when another tab activates the vault, or
when the user selects the manual lock action.

The 15-minute inactivity interval is currently a source-code constant. That
provides a predictable secure baseline, but it requires a new application
release if an approved clinic security policy later requires a shorter or
longer interval. Different clinics may adopt different reasonable intervals
based on device placement, staffing, physical controls, workflow interruption,
and privacy guidance.

A configurable interval affects privacy risk and the approved operating
environment. It must not become an unrestricted convenience preference or
create a "never lock" mode. NodeDent also has no user accounts, administrator
role, server policy service, or identity-grade administrative audit trail. A
vault passphrase demonstrates access to the local vault but does not prove that
the person changing a setting is a clinic administrator.

## Decision

NodeDent should provide an unlocked-vault Settings page with a **Local security
policy** section. The first configurable security parameter should be the
clinical-vault inactivity timeout.

The initial timeout policy should:

- default to 15 minutes;
- offer only reviewed values of 5, 10, 15, 20, and 30 minutes;
- enforce 30 minutes as the maximum;
- provide no disabled, unlimited, zero, or "never lock" value;
- apply a changed value immediately and consistently across open tabs;
- fall back to 15 minutes when the stored value is absent, unsupported, or
  corrupt.

The Settings page should display the other effective lock controls, but the
initial implementation should keep these controls mandatory and read-only:

- explicit manual lock;
- lock when the page becomes hidden;
- lock when the user leaves the page;
- lock when another tab activates the vault.

Making any of these immediate lock controls optional requires a separate
security, privacy, and usability review and an amendment or superseding ADR.

## Authorization Boundary

Changing the inactivity policy should require:

- an unlocked clinical vault;
- re-entry of the vault passphrase;
- a confirmation that identifies the old and new timeout;
- an acknowledgement that the setting must match the clinic's approved
  device/browser configuration.

The interface must describe this as local policy confirmation, not administrator
authorization. Any person who knows the vault passphrase may be able to make the
change. A clinic that requires administrator-only enforcement must rely on its
approved device, operating-system, browser-profile, and passphrase-custody
controls until NodeDent has a separately designed identity and authorization
model.

## Persistence And Recovery

The effective policy should be stored as versioned encrypted vault metadata
rather than as an ordinary browser preference. It should:

- remain separate from clinical case events and notes;
- be authenticated by the vault encryption boundary;
- be included in encrypted whole-vault backup and restore;
- use an explicit schema version and validated timeout value;
- preserve a non-sensitive policy revision, prior value, change timestamp, and
  application version for local troubleshooting;
- avoid storing staff names or claiming verified user identity;
- broadcast changes so all active tabs adopt the new value or lock safely.

The recorded timestamp is device-supplied metadata, not proof of identity or an
identity-grade audit event. A failed metadata read, validation failure, or
unsupported future value must select the 15-minute safe default and visibly
inform the user.

## User Experience

The settings surface should:

- show the currently effective timeout before a change;
- explain which interactions reset the timer;
- show the mandatory immediate-lock controls;
- warn that unsaved or failed saves do not become durable merely because the
  vault is locking;
- identify the setting as applying to the restored local vault rather than to a
  NodeDent account;
- direct the operator to clinic policy instead of suggesting which timeout the
  clinic should approve.

Changing the timeout should restart the inactivity timer using the newly
selected value. Selecting a shorter value must not extend an already elapsed
period of inactivity; the implementation should lock immediately if the
elapsed interval already meets or exceeds the new policy.

## Verification And Approval

Implementation is not complete until:

- encrypted policy metadata, validation, fallback, backup, and restore behavior
  have automated tests;
- timer reset, elapsed-time handling, cross-tab propagation, and lock behavior
  have browser-level tests;
- corrupt, missing, downgraded, and unsupported policy values select the safe
  default;
- the settings surface is keyboard, touch, zoom, and screen-reader tested;
- the deployment guide, threat model, device/browser checklist, training
  material, collection/privacy notices where applicable, and release-readiness
  evidence are reviewed and updated;
- the clinic records the chosen timeout in its approved device/browser
  configuration and completes synthetic testing on the target device;
- the privacy and operational reviewers determine whether the PIA or go-live
  approval must be amended.

Until this ADR is accepted and the behavior is implemented and approved, the
existing hard-coded 15-minute inactivity timeout remains controlling.

## Consequences

- Clinics can align the inactivity interval with approved policy without a
  source-code release.
- Secure bounds and mandatory immediate-lock triggers limit accidental weakening
  of the local clinical mode.
- The policy follows encrypted vault backup and restore, which may require the
  receiving device to reapprove a restored configuration.
- Passphrase confirmation adds friction but does not create administrator
  identity or authorization.
- Policy metadata introduces a versioned persistence and migration obligation.
- Release and clinic evidence must identify the effective timeout rather than
  assuming every deployment uses 15 minutes.

## Alternatives Considered

- **Keep the timeout hard-coded:** simplest and easiest to audit, but every
  approved policy change requires a new application release.
- **Allow arbitrary minute values:** flexible, but difficult to validate,
  support, test, and approve consistently.
- **Offer a "never lock" option:** rejected because it defeats the unattended
  workspace control required by constrained local clinical mode.
- **Store the timeout in ordinary `localStorage`:** easy to implement, but
  unauthenticated and disconnected from the encrypted vault backup boundary.
- **Claim passphrase holders are administrators:** rejected because the current
  product has no identity or role model capable of supporting that claim.
- **Make every lock trigger configurable immediately:** deferred because hidden
  page, navigation, and cross-tab locks address distinct exposure risks and
  require their own evidence before weakening.

## Future Reconsideration

Revisit this decision if NodeDent introduces clinic accounts, managed device
policy, signed configuration profiles, centralized administration, user
identity, or identity-grade security audit logs. Those capabilities may support
administrator-only configuration and policy enforcement that the constrained
local vault cannot currently provide.

