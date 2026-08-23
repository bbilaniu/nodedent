# ADR 0011: Define Isolated Local Vault Profiles

## Status

Proposed

## Context

NodeDent currently has one protected clinical vault in one fixed IndexedDB
namespace. An encrypted whole-vault restore can therefore either populate an
empty browser profile or replace the existing vault. Replacement is deliberately
destructive. By contrast, importing a backup from inside an unlocked vault can
add new encounters and explicitly resolve conflicts without deleting the whole
vault.

Keeping one vault makes the active clinical context easy to understand. It also
means that a backup cannot be restored beside the current vault for inspection
or for a genuinely separate operating context. Multiple vaults could be useful
for approved, intentionally isolated contexts such as separate clinics or a
synthetic training environment. They must not become a substitute for case
organization, encounter history, backup retention, or conflict resolution.

A vault selector also introduces new clinical-data risks. An operator could open
or chart in the wrong context, autosave could cross a storage boundary, a restore
could target the wrong vault, or an unencrypted selector label could disclose
identifying information. This is therefore a persistence and security-boundary
change rather than only a user-interface enhancement.

## Decision

NodeDent should permit multiple **isolated local vault profiles** only after the
implementation gate in this ADR is satisfied. The current single-vault model
remains controlling until then.

The capability is intended for explicitly separate operating contexts. It is
not intended to create one vault per patient, case, clinician, or backup version.
The product must continue to present cases within a vault as the normal unit of
work and must retain the existing non-destructive encrypted-backup import flow
for combining case data.

Only one vault may be unlocked in a browser profile at a time. Unlocking or
switching to another vault must first complete or visibly fail pending writes,
lock the current vault, discard its usable key and decrypted application state,
and reset all active encounter state. This rule applies across tabs as well as
within one page.

## Vault Identity And Storage

Each local vault profile should have two distinct random identifiers:

- A **vault instance ID** identifies one local storage namespace and its
  cross-tab lock channel. It is generated locally and is never copied when a
  backup is restored as a new vault.
- A **vault lineage ID** is encrypted vault metadata that follows whole-vault
  backups. It records provenance and permits warnings when another local vault
  already descends from the same backup lineage. It does not select a restore
  target or permit one vault instance to access another.

Encounter IDs remain immutable within backups and imports. Separate vault
namespaces provide isolation; they do not erase the need for encounter-level
conflict detection when data is imported into an existing vault.

Each vault instance should use a separate IndexedDB database rather than adding
a vault discriminator to every clinical record in the existing database. A
small registry may locate the available databases, but it must be treated as
untrusted, non-clinical browser metadata and contain only what is necessary to
select and open a vault:

- registry format version;
- vault instance ID and storage locator;
- creation timestamp and lifecycle state;
- an optional neutral display label with an explicit prohibition on patient
  identifiers or clinical facts.

The selector must not expose chart numbers, diagnoses, procedures, record
counts, active-case facts, or the encrypted lineage ID. The initial interface
should work without a custom label by showing a neutral generated name and a
short instance-ID suffix. Any registry corruption, orphan database, interrupted
creation, or interrupted deletion must fail closed and offer an explicit repair
or cleanup path without reading clinical records into the wrong vault.

Because IndexedDB operations across separate databases are not one transaction,
creation, restore, replacement, and deletion must use staged lifecycle states
and recover safely after interruption. Deleting or replacing one vault must
never clear another vault database or registry entry.

## Unlocking And Context Safety

Every vault keeps an independent passphrase, key derivation configuration,
retention metadata, lock policy, recovery history, and active encounter. Knowing
one vault passphrase must not unlock, enumerate encrypted contents from, or
change another vault.

After unlock, the workspace must display a persistent vault-context indicator.
A synthetic training vault must be visually distinguishable from a clinical
vault and must not be inferred from a user-entered label alone. Switching vaults
must be an explicit action and must not happen as a side effect of selecting a
backup.

If a pending save cannot be made durable, NodeDent must not imply that switching
or locking preserved it. The operator must receive the existing safe recovery
options before leaving the current context.

## Backup And Restore Semantics

The interface must distinguish three operations:

1. **Import cases into the current vault** authenticates and compares an
   encrypted backup, adds safe new encounters, and explicitly resolves conflicts.
   It does not change the selected vault.
2. **Restore backup as a new vault** authenticates the entire backup before
   registering a new local vault instance. It assigns a new vault instance ID
   while preserving encrypted lineage when the backup format supports it.
3. **Replace a selected vault from backup** is an advanced disaster-recovery
   action. It names the target vault, states how many current protected cases
   will be removed, offers a current-vault backup first, and requires explicit
   destructive confirmation.

A matching lineage ID may trigger a duplicate-lineage warning, but must never
silently select, overwrite, merge, or delete a vault. A backup without lineage
metadata must remain restorable through an explicit compatibility path that
assigns lineage during the authenticated restore.

Replacement should retain the target's local vault instance ID so its registry
and storage identity remain stable, while adopting the authenticated backup's
encrypted vault contents and lineage. All records must authenticate before the
target vault is mutated, and failure must leave the prior vault recoverable.

## Persistence Scope Outside The Vault

Multi-vault implementation must classify every persisted value as vault-scoped
or browser-profile-scoped. Clinical records, identifying indexes, active
encounter state, encrypted recovery history, retention configuration, and vault
security policy are vault-scoped.

Display theme and the existing patient-independent shortcut catalogues may
remain browser-profile-scoped under the current privacy boundary. If retained
there, the interface must disclose that they are shared across local vaults and
they must remain excluded from encrypted whole-vault restore. Making catalogues
clinic-specific or including them in a vault requires a separate migration and
product decision; it must not happen implicitly as part of multi-vault storage.

## Existing Vault Migration

The existing `nodedent-clinical-vault-v1` database must not be silently copied or
re-encrypted. A migration should register it as the initial local vault only
after its metadata is validated. The migration must be idempotent, preserve the
ability to unlock with the existing passphrase, and provide a tested rollback or
recovery route before the single-vault application can no longer open it.

Existing encrypted backups remain recovery artifacts. Adding lineage to a new
backup format must use an explicit schema version and retain tested support for
the currently supported format.

## Implementation Gate

This ADR does not authorize implementation or clinical use of multiple vaults
until all of the following are complete:

1. A concrete approved use case identifies why isolated vaults are required and
   why the existing case-import flow is insufficient.
2. An implementation spec defines the registry schema, database lifecycle,
   migration, backup versioning, deletion, repair, and rollback behavior.
3. The local clinical threat model, privacy policy, deployment guide, operator
   training, and applicable clinic privacy and operational review address vault
   selection and wrong-context risk.
4. Automated tests prove storage, keys, decrypted state, autosaves, active
   encounters, recovery history, broadcasts, and destructive operations cannot
   cross vault boundaries.
5. Browser tests cover interrupted migration and restore, corrupt registry data,
   duplicate lineage, wrong passphrases, stale tabs, save failure during switch,
   keyboard and screen-reader selection, and narrow or zoomed layouts.
6. Legacy single-vault and backup compatibility is demonstrated before the new
   selector becomes the default entry path.

Until this ADR is accepted and its implementation gate is complete, NodeDent
continues to use one local clinical vault. Whole-vault restore may replace that
vault only through explicit destructive confirmation; non-destructive case
combination continues through encrypted-backup import from inside the unlocked
vault.

## Consequences

- Separate clinic or training contexts can coexist without merging their cases.
- Restoring as a new vault provides a non-destructive way to inspect or recover
  a complete backup while preserving the current vault.
- Operators must identify the correct vault before unlocking and must maintain
  separate passphrases and backup practices where applicable.
- Registry, migration, lifecycle recovery, and selector behavior materially
  expand the protected-storage and testing surface.
- Multiple local copies can diverge. NodeDent remains a local temporary
  workspace and does not become a synchronization system or official record.
- Neutral selector metadata reduces pre-unlock disclosure but makes vault
  selection less descriptive; persistent post-unlock context becomes essential.

## Alternatives Considered

- **Keep one vault and use non-destructive case import:** remains the preferred
  model when all cases belong to one operating context. It has less
  wrong-context and lifecycle complexity.
- **Partition one IndexedDB database by vault ID:** reduces database discovery
  and registry work, but every query and transaction must correctly apply the
  partition key. A missing filter could expose or mutate another vault, so this
  is rejected for the initial design.
- **Restore a backup beside the current vault without a persistent vault
  model:** rejected because temporary implicit namespaces would obscure which
  data is active and how it is later locked, backed up, or deleted.
- **Use one global passphrase for every vault:** rejected because it couples
  otherwise isolated contexts and makes switching appear safer than the current
  identity and authorization model can guarantee.
- **Use custom clinic or patient names in the pre-unlock selector:** rejected as
  a default because selector metadata is outside the encrypted vault and could
  disclose context on a locked device.
- **Allow multiple vaults to remain unlocked in different tabs:** rejected
  because it increases wrong-context, key-lifecycle, and autosave-isolation risk.

## Future Reconsideration

Revisit this proposal if the validated use case can be met more safely through
better case filtering, archived encounters, encrypted-backup import, or a
dedicated synthetic training mode. Server accounts, cross-device sync, shared
clinic vaults, user roles, or centralized administration require separate
architecture and do not follow from this local multi-vault proposal.
