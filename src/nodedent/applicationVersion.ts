import { version as packageVersion } from "../../package.json";

export const applicationVersion = typeof packageVersion === "string" && packageVersion.trim()
  ? packageVersion.trim()
  : "";
