import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const targets = [
  // 14 Core Screens matching Reference Design
  { name: "screen_01_welcome", url: "http://localhost:3000/welcome", width: 390, height: 844 },
  { name: "screen_02_auth", url: "http://localhost:3000/auth", width: 390, height: 844 },
  { name: "screen_03_home", url: "http://localhost:3000/home", width: 390, height: 844 },
  { name: "screen_04_explore", url: "http://localhost:3000/explore", width: 390, height: 844 },
  { name: "screen_05_job_detail", url: "http://localhost:3000/jobs/job_google_fe_intern", width: 390, height: 844 },
  { name: "screen_06_match", url: "http://localhost:3000/jobs/job_google_fe_intern/match", width: 390, height: 844 },
  { name: "screen_07_apply_step1", url: "http://localhost:3000/jobs/job_google_fe_intern/apply?step=1", width: 390, height: 844 },
  { name: "screen_08_apply_step2_resume", url: "http://localhost:3000/jobs/job_google_fe_intern/apply?step=2", width: 390, height: 844 },
  { name: "screen_09_apply_step4_review", url: "http://localhost:3000/jobs/job_google_fe_intern/apply?step=4", width: 390, height: 844 },
  { name: "screen_10_success", url: "http://localhost:3000/applications/success?ref=AVS-2025-0412-8937&job=job_google_fe_intern", width: 390, height: 844 },
  { name: "screen_11_applications", url: "http://localhost:3000/applications", width: 390, height: 844 },
  { name: "screen_12_profile", url: "http://localhost:3000/profile", width: 390, height: 844 },
  { name: "screen_13_admin_desktop", url: "http://localhost:3000/admin", width: 1440, height: 900 },
  { name: "screen_14_saved", url: "http://localhost:3000/saved", width: 390, height: 844 },

  // Phase 5 Required Viewport Sizes
  { name: "viewport_320x720_home", url: "http://localhost:3000/home", width: 320, height: 720 },
  { name: "viewport_375x812_explore", url: "http://localhost:3000/explore", width: 375, height: 812 },
  { name: "viewport_390x844_job_detail", url: "http://localhost:3000/jobs/job_google_fe_intern", width: 390, height: 844 },
  { name: "viewport_430x932_match", url: "http://localhost:3000/jobs/job_google_fe_intern/match", width: 430, height: 932 },
  { name: "viewport_768x1024_tablet_portrait", url: "http://localhost:3000/explore", width: 768, height: 1024 },
  { name: "viewport_1024x768_tablet_landscape", url: "http://localhost:3000/home", width: 1024, height: 768 },
  { name: "viewport_1440x900_desktop", url: "http://localhost:3000/admin", width: 1440, height: 900 },
];

console.log(`Starting capture of ${targets.length} screens and responsive viewports...`);

for (const t of targets) {
  const outputPath = path.join(SCREENSHOT_DIR, `${t.name}.png`);
  console.log(`[Capturing] ${t.name} (${t.width}x${t.height}) -> ${t.url}`);
  try {
    execFileSync(
      CHROME_PATH,
      [
        "--headless=new",
        `--screenshot=${outputPath}`,
        `--window-size=${t.width},${t.height}`,
        "--hide-scrollbars",
        "--disable-gpu",
        t.url,
      ],
      { stdio: "ignore", timeout: 25000 }
    );
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`  ✓ Saved ${t.name}.png (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.error(`  ✗ Output file not found for ${t.name}`);
    }
  } catch (err) {
    console.error(`  ✗ Failed to capture ${t.name}:`, err.message);
  }
}

console.log("\nAll screens and viewports captured successfully!");
