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

    // Admin button must NEVER be exposed in public desktop navigation for security & privacy
    assert.doesNotMatch(content, /Admin Portal/, "Desktop navigation must not expose Admin Portal for security and privacy");

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

    // Production sections below the fold
    assert.match(content, /id="how-it-works"/, "Must include how-it-works section");
    assert.match(content, /id="for-employers"/, "Must include employer partnership section");
    assert.match(content, /<footer/, "Must include production footer");

    // Mobile header hidden on desktop to avoid duplicate branding
    assert.match(content, /className="flex md:hidden items-center/, "Mobile header must hide on desktop");
  });

  await t.test("Home page provides responsive 2-column desktop dashboard with main feed and sidebar", () => {
    const homePagePath = path.join(rootDir, "src/app/home/page.tsx");
    const content = fs.readFileSync(homePagePath, "utf-8");

    assert.match(content, /lg:grid-cols-12/, "Home page must use 12-column grid on desktop");
    assert.match(content, /lg:col-span-8/, "Main feed must occupy 8 columns on desktop");
    assert.match(content, /lg:col-span-4/, "Activity sidebar must occupy 4 columns on desktop");
  });

  await t.test("Explore, Saved, Applications, and Profile pages hide mobile header on desktop and show desktop banners", () => {
    const exploreContent = fs.readFileSync(path.join(rootDir, "src/app/explore/page.tsx"), "utf-8");
    const savedContent = fs.readFileSync(path.join(rootDir, "src/app/saved/page.tsx"), "utf-8");
    const applicationsContent = fs.readFileSync(path.join(rootDir, "src/app/applications/page.tsx"), "utf-8");
    const profileContent = fs.readFileSync(path.join(rootDir, "src/app/profile/page.tsx"), "utf-8");

    assert.match(exploreContent, /className="md:hidden"/, "Explore must hide mobile header on desktop");
    assert.match(exploreContent, /Explore Opportunities/, "Explore must provide desktop title banner");
    assert.match(exploreContent, /lg:grid-cols-3/, "Explore must support 3-column cards on desktop");

    assert.match(savedContent, /className="md:hidden"/, "Saved must hide mobile header on desktop");
    assert.match(savedContent, /Saved Opportunities/, "Saved must provide desktop title banner");

    assert.match(applicationsContent, /className="md:hidden"/, "Applications must hide mobile header on desktop");
    assert.match(applicationsContent, /Application Tracker/, "Applications must provide desktop title banner");

    assert.match(profileContent, /className="md:hidden"/, "Profile must hide mobile header on desktop");
    assert.match(profileContent, /Candidate Profile/, "Profile must provide desktop title banner");
  });

  await t.test("Auth portal provides centered responsive desktop card layout", () => {
    const authPagePath = path.join(rootDir, "src/app/auth/page.tsx");
    const content = fs.readFileSync(authPagePath, "utf-8");

    assert.match(content, /md:max-w-md/, "Auth container must constrain max-width on desktop");
    assert.match(content, /md:bg-white/, "Auth container must provide white card background on desktop");
    assert.match(content, /md:rounded-3xl/, "Auth container must provide rounded card styling on desktop");
  });
});
