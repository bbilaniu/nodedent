import { chromium } from "@playwright/test";
import { checkDeployedSite, smokeTarget } from "./lib/deployedSite";

const target = smokeTarget(process.env);
const browser = await chromium.launch();
try {
  console.log(JSON.stringify(await checkDeployedSite(browser, target), null, 2));
} finally {
  await browser.close();
}
