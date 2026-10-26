#!/usr/bin/env node
/**
 * Synthetic Load Test Data Generator for Avsar High-Concurrency Testing
 *
 * Generates synthetic candidates and jobs for staging and load-testing environments.
 * Prevents contamination of production records with simulated test accounts.
 *
 * Usage:
 *   node scripts/generate-synthetic-load-data.mjs --candidates 200 --jobs 100 --out data/synthetic-load.json
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return defaultValue;
}

const candidateCount = parseInt(getArg("candidates", "100"), 10);
const jobCount = parseInt(getArg("jobs", "50"), 10);
const outputPath = getArg("out", path.join(process.cwd(), "data", "synthetic-load.json"));

const DOMAINS = ["Software Engineering", "Product Management", "Data & AI", "Design & UX", "Cloud DevOps"];
const LOCATIONS = ["Bangalore, India", "Hyderabad, India", "Gurgaon, India", "Pune, India", "Remote"];
const SKILL_POOLS = [
  ["TypeScript", "React", "Next.js", "Node.js", "Tailwind CSS"],
  ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
  ["Java", "Spring Boot", "Microservices", "Kafka", "Kubernetes"],
  ["Data Analysis", "SQL", "Pandas", "Tableau", "Machine Learning"],
  ["Figma", "UI Design", "User Research", "Wireframing", "Design Systems"],
];

console.log(`[Load Data Generator] Generating ${candidateCount} synthetic candidates and ${jobCount} synthetic jobs...`);

const candidates = [];
for (let i = 1; i <= candidateCount; i++) {
  const id = `syn_cand_${String(i).padStart(4, "0")}`;
  const skills = SKILL_POOLS[i % SKILL_POOLS.length];
  const gradYear = 2024 + (i % 3);

  candidates.push({
    id,
    aiTathastuId: `tathastu_syn_${randomUUID().slice(0, 8)}`,
    name: `Synthetic Candidate ${i}`,
    email: `candidate.${i}@synthetic.avsar.local`,
    role: "Candidate",
    headline: `Aspiring Engineer | Class of ${gradYear}`,
    college: `Institute of Engineering & Technology #${(i % 10) + 1}`,
    batch: gradYear,
    degree: "B.Tech Computer Science",
    graduationBatch: String(gradYear),
    skills,
    location: LOCATIONS[i % LOCATIONS.length],
    profileCompletion: 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

const jobs = [];
for (let j = 1; j <= jobCount; j++) {
  const id = `syn_job_${String(j).padStart(4, "0")}`;
  const domain = DOMAINS[j % DOMAINS.length];
  const skills = SKILL_POOLS[j % SKILL_POOLS.length];
  const location = LOCATIONS[j % LOCATIONS.length];
  const isIntern = j % 2 === 0;

  jobs.push({
    id,
    title: `${isIntern ? "Graduate Intern" : "Associate Engineer"} - ${domain}`,
    company: `Synthetic Tech Corp #${(j % 15) + 1}`,
    location,
    workArrangement: j % 3 === 0 ? "Remote" : j % 3 === 1 ? "Hybrid" : "On-site",
    employmentType: isIntern ? "Internship" : "Full-time",
    category: domain,
    stipend: isIntern ? "₹35,000 / month" : undefined,
    ctc: !isIntern ? "₹12,00,000 - ₹16,00,000" : undefined,
    description: `Synthetic benchmark job description for high-concurrency simulation of ${domain} opportunities.`,
    requiredSkills: skills,
    eligibilityBatch: [2024, 2025, 2026],
    postedAt: new Date(Date.now() - (j * 3600000)).toISOString(),
    status: "Active",
    verification: "Verified",
    slug: `synthetic-${domain.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${j}`,
  });
}

const outputData = {
  metadata: {
    generatedAt: new Date().toISOString(),
    candidateCount,
    jobCount,
    purpose: "High-concurrency load testing and benchmark simulation",
    environment: "synthetic-staging",
  },
  candidates,
  jobs,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf8");

console.log(`[Load Data Generator] Successfully wrote synthetic dataset to ${outputPath}`);
