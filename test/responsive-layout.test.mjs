import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("Responsive Shell & Layout Verification", async (t) => {
  await t.test("MobileShell defaults to fluid responsive layout without fake iPhone status bar", () => {
    const mobileShellPath = path.join(rootDir, "src/components/layout/MobileShell.tsx");
    const content = fs.readFileSync(mobileShellPath, "utf-8");

    // Must default to fluid responsive mode
    assert.match(
      content,
      /return\s+"fluid";/,
      "MobileShell must initialize deviceMode to 'fluid' by default"
    );

    // Demo suite bar must be hidden by default
    assert.match(
      content,
      /return\s+false;/,
      "showSuiteBar must default to false"
    );
    assert.match(
      content,
      /params\.get\("suite"\)\s*===\s*"true"/,
      "Demo suite bar must require explicit ?suite=true parameter"
    );

    // Fake status bar must only render when explicitly in phone frame mode
    assert.match(
      content,
      /deviceMode\s*===\s*"phone"\s*&&\s*\(/,
      "Fake iPhone status bar must be guarded by deviceMode === 'phone'"
    );

    // Must include desktop navbar with primary navigation
    assert.match(content, /Desktop Primary Navigation/, "Must include desktop primary navigation landmark");
    assert.match(content, /href="\/home"/, "Desktop nav must link to /home");
    assert.match(content, /href="\/explore"/, "Desktop nav must link to /explore");
    assert.match(content, /href="\/saved"/, "Desktop nav must link to /saved");
    assert.match(content, /href="\/applications"/, "Desktop nav must link to /applications");
    assert.match(content, /href="\/profile"/, "Desktop nav must link to /profile");
    assert.match(content, /href="\/admin"/, "Desktop nav must link to /admin");

    // BottomNav must be constrained to mobile screens
    assert.match(content, /className="md:hidden"/, "BottomNav must be wrapped in md:hidden to prevent desktop duplication");
  });

  await t.test("Welcome page provides responsive 2-column desktop hero and eliminates CTA button cutoff", () => {
    const welcomePagePath = path.join(rootDir, "src/app/welcome/page.tsx");
    const content = fs.readFileSync(welcomePagePath, "utf-8");

    // Grid layout for desktop
    assert.match(content, /md:grid-cols-12/, "Welcome hero must use a responsive 12-column grid on desktop");
    assert.match(content, /md:col-span-7/, "Editorial value prop must occupy 7 columns on desktop");
    assert.match(content, /md:col-span-5/, "Visual image composition must occupy 5 columns on desktop");

    // Eliminates rigid overflow that clipped the CTA button
    assert.doesNotMatch(content, /min-h-\[360px\]/, "Must not contain rigid min-h-[360px] that caused CTA clipping");

    // CTAs and links
    assert.match(content, /href="\/auth"/, "Must link to /auth for Get Started and Sign In");
    assert.match(content, /href="\/explore"/, "Must provide secondary link to explore opportunities");
    assert.match(content, /Get Started/, "Must include 'Get Started' action text");
    assert.match(content, /Sign In/, "Must include 'Sign In' action text");

    // Mobile header hidden on desktop to avoid duplicate branding
    assert.match(content, /className="flex md:hidden items-center/, "Mobile header must hide on desktop");
  });

  await t.test("Auth portal provides centered responsive desktop card layout", () => {
    const authPagePath = path.join(rootDir, "src/app/auth/page.tsx");
    const content = fs.readFileSync(authPagePath, "utf-8");

    assert.match(content, /md:max-w-md/, "Auth container must constrain max-width on desktop");
    assert.match(content, /md:bg-white/, "Auth container must provide white card background on desktop");
    assert.match(content, /md:rounded-3xl/, "Auth container must provide rounded card styling on desktop");
  });
});
