import test from "node:test";
import assert from "node:assert/strict";
import { isReadOnlySmokeRequest, smokeTarget, verifySmokeIdentity } from "../lib/deployedSite";

const environment = {
  NODEDENT_SMOKE_URL: "https://nodedent.example",
  NODEDENT_SMOKE_VERSION: "2.4.3",
  NODEDENT_SMOKE_MODE: "current",
  NODEDENT_SMOKE_BRANCH: "main",
  NODEDENT_SMOKE_COMMIT: "a".repeat(40),
};

test("smoke requires independent, consistent expected identity before accessing a site", () => {
  assert.equal(smokeTarget(environment).mode, "current");
  for (const key of Object.keys(environment)) assert.throws(() => smokeTarget({ ...environment, [key]: "" }));
  for (const url of ["http://nodedent.example", "https://user:secret@nodedent.example", "https://nodedent.example/path", "https://nodedent.example/?secret=x"]) {
    assert.throws(() => smokeTarget({ ...environment, NODEDENT_SMOKE_URL: url }));
  }
  assert.throws(() => smokeTarget({ ...environment, NODEDENT_SMOKE_BRANCH: "beta" }));
  assert.throws(() => smokeTarget({ ...environment, NODEDENT_SMOKE_COMMIT: "abcdef1" }));
});

test("smoke rejects stale, wrong-mode, wrong-origin and incomplete deployment metadata", () => {
  const target = smokeTarget(environment);
  const identity = { applicationVersion: target.version, mode: target.mode, branch: target.branch, commitSha: target.commit, expectedOrigin: target.url };
  assert.doesNotThrow(() => verifySmokeIdentity(identity, target));
  for (const key of Object.keys(identity)) {
    assert.throws(() => verifySmokeIdentity({ ...identity, [key]: "wrong" }, target));
    assert.throws(() => verifySmokeIdentity({ ...identity, [key]: undefined }, target));
  }
});

test("smoke request policy permits only same-origin GETs", () => {
  assert.equal(isReadOnlySmokeRequest("https://nodedent.example/assets/app.js", "GET", environment.NODEDENT_SMOKE_URL), true);
  assert.equal(isReadOnlySmokeRequest("https://other.example", "GET", environment.NODEDENT_SMOKE_URL), false);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(isReadOnlySmokeRequest(environment.NODEDENT_SMOKE_URL, method, environment.NODEDENT_SMOKE_URL), false);
});
