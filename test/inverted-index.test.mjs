import test from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lib/search/tokenizer.ts";
import { InvertedIndex } from "../src/lib/search/inverted-index.ts";
import {
  searchJobs,
  indexJob,
  resetSearchIndexForTesting,
} from "../src/lib/search/index.ts";

test("Tokenizer: cleans, lowercases, and strips stopwords", () => {
  const tokens = tokenize("Senior Software Engineer with Go and Kubernetes in Bengaluru");
  assert.ok(tokens.includes("senior"));
  assert.ok(tokens.includes("software"));
  assert.ok(tokens.includes("engineer"));
  assert.ok(tokens.includes("go"));
  assert.ok(tokens.includes("kubernetes"));
  assert.ok(tokens.includes("bengaluru"));
  assert.ok(!tokens.includes("with"), "Stopword 'with' should be removed");
  assert.ok(!tokens.includes("and"), "Stopword 'and' should be removed");
  assert.ok(!tokens.includes("in"), "Stopword 'in' should be removed");
});

test("InvertedIndex: indexes and ranks jobs by field relevance", () => {
  const index = new InvertedIndex();

  const jobA = {
    id: "job_a",
    slug: "frontend-engineer",
    title: "Senior Frontend Engineer",
    company: "Acme Tech",
    companyLogoKey: "acme",
    location: "Bengaluru, India",
    workArrangement: "Hybrid",
    employmentType: "Full Time",
    compensation: "₹24 LPA",
    overview: "Build web user interfaces using React and TypeScript.",
    requirements: ["React", "TypeScript"],
    responsibilities: [],
    benefits: [],
    requiredSkills: ["React", "TypeScript", "Tailwind CSS"],
    optionalSkills: [],
    minExperienceMonths: 36,
    educationRequirement: "B.Tech",
    isFeatured: true,
    postedAt: "1 day ago",
    sourcePlatform: "Direct",
    applicationLinkType: "Direct",
    verificationStatus: "VERIFIED",
    isPossiblyClosed: false,
    isExternalApplication: false,
  };

  const jobB = {
    id: "job_b",
    slug: "backend-engineer",
    title: "Backend Engineer (Go)",
    company: "Cloud Corp",
    companyLogoKey: "cloud",
    location: "Remote",
    workArrangement: "Remote",
    employmentType: "Full Time",
    compensation: "₹28 LPA",
    overview: "Build distributed microservices. Mentions React frontend collaboration.",
    requirements: ["Go", "Kubernetes"],
    responsibilities: [],
    benefits: [],
    requiredSkills: ["Go", "Kubernetes", "PostgreSQL"],
    optionalSkills: [],
    minExperienceMonths: 24,
    educationRequirement: "B.Tech",
    isFeatured: false,
    postedAt: "2 days ago",
    sourcePlatform: "Direct",
    applicationLinkType: "Direct",
    verificationStatus: "VERIFIED",
    isPossiblyClosed: false,
    isExternalApplication: false,
  };

  index.indexJobs([jobA, jobB]);

  // Searching for "Frontend" matches both (title vs overview), but jobA ranks top with higher title weight
  const frontendResults = index.search("Frontend");
  assert.equal(frontendResults.length, 2);
  assert.equal(frontendResults[0].jobId, "job_a");
  assert.ok(frontendResults[0].score > frontendResults[1].score);

  // Searching for "React" matches both, but jobA has it in requiredSkills, so score is higher
  const reactResults = index.search("React");
  assert.equal(reactResults.length, 2);
  assert.equal(reactResults[0].jobId, "job_a", "jobA should rank higher for React");
  assert.ok(reactResults[0].score > reactResults[1].score);

  // Searching for "Go" matches jobB
  const goResults = index.search("Go");
  assert.equal(goResults.length, 1);
  assert.equal(goResults[0].jobId, "job_b");
});

test("InvertedIndex: supports dynamic job removal", () => {
  const index = new InvertedIndex();
  const mockJob = {
    id: "job_removable",
    title: "DevOps Specialist",
    company: "Infra Ltd",
    requiredSkills: ["Terraform", "AWS"],
  };

  index.indexJob(mockJob);
  assert.equal(index.search("DevOps").length, 1);

  index.removeJob("job_removable");
  assert.equal(index.search("DevOps").length, 0);
  assert.equal(index.size(), 0);
});

test("Unified Search Facade: routes queries via global singleton", () => {
  resetSearchIndexForTesting();

  indexJob({
    id: "job_facade_1",
    title: "Machine Learning Researcher",
    company: "AI Labs",
    requiredSkills: ["PyTorch", "Transformers"],
  });

  const results = searchJobs("Machine Learning");
  assert.equal(results.length, 1);
  assert.equal(results[0].jobId, "job_facade_1");

  resetSearchIndexForTesting();
});
