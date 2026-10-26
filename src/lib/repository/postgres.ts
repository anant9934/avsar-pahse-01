import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { query, withTransaction } from "../db/postgres.ts";
import type { Application, Candidate, Job, Resume } from "../../types/index.ts";
import type {
  ApplicationRepository,
  AuditRepository,
  CandidateRepository,
  JobFilterOptions,
  JobRepository,
  ResumeRepository,
  SavedJobRepository,
} from "./types.ts";
import { calculateProfileCompletion } from "../db/index.ts";

// -----------------------------------------------------------------------------
// Row Mapping Helpers
// -----------------------------------------------------------------------------

function mapCandidateRow(row: QueryResultRow, tathastuId?: string): Candidate {
  return {
    id: row.id,
    aiTathastuId: tathastuId || row.ai_tathastu_id || undefined,
    name: row.name,
    headline: row.headline || "",
    email: row.email,
    phone: row.phone || "+91 98765 00000",
    location: row.location || "Bengaluru, India",
    avatar: row.avatar || "/images/avatar-rohan.jpg",
    bio: row.bio || "",
    skills: Array.isArray(row.skills) ? row.skills : typeof row.skills === "string" ? JSON.parse(row.skills) : [],
    education: Array.isArray(row.education) ? row.education : typeof row.education === "string" ? JSON.parse(row.education) : [],
    experience: Array.isArray(row.experience) ? row.experience : typeof row.experience === "string" ? JSON.parse(row.experience) : [],
    projects: Array.isArray(row.projects) ? row.projects : typeof row.projects === "string" ? JSON.parse(row.projects) : [],
    preferences: typeof row.preferences === "object" && row.preferences !== null ? row.preferences : typeof row.preferences === "string" ? JSON.parse(row.preferences) : {},
    erisScore: row.eris_score ?? 85,
    profileCompletionPercentage: row.profile_completion_percentage ?? 50,
  };
}

function mapJobRow(row: QueryResultRow): Job {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company: row.company,
    companyLogoKey: row.company_logo_key || "default",
    heroImage: row.hero_image || undefined,
    location: row.location,
    workArrangement: row.work_arrangement,
    employmentType: row.employment_type,
    compensation: row.compensation,
    deadline: row.deadline || undefined,
    department: row.department || undefined,
    category: row.category || undefined,
    overview: row.overview || "",
    requirements: Array.isArray(row.requirements) ? row.requirements : typeof row.requirements === "string" ? JSON.parse(row.requirements) : [],
    responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : typeof row.responsibilities === "string" ? JSON.parse(row.responsibilities) : [],
    benefits: Array.isArray(row.benefits) ? row.benefits : typeof row.benefits === "string" ? JSON.parse(row.benefits) : [],
    requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : typeof row.required_skills === "string" ? JSON.parse(row.required_skills) : [],
    optionalSkills: Array.isArray(row.optional_skills) ? row.optional_skills : typeof row.optional_skills === "string" ? JSON.parse(row.optional_skills) : [],
    minExperienceMonths: row.min_experience_months ?? 0,
    educationRequirement: row.education_requirement || undefined,
    isFeatured: Boolean(row.is_featured),
    postedAt: row.posted_at || "Recently",
    sourceJobId: row.source_job_id || undefined,
    sourcePlatform: row.source_platform || undefined,
    graduationYears: Array.isArray(row.graduation_years) ? row.graduation_years : typeof row.graduation_years === "string" ? JSON.parse(row.graduation_years) : [],
    salaryDetails: row.salary_details ? (typeof row.salary_details === "string" ? JSON.parse(row.salary_details) : row.salary_details) : undefined,
    applyUrl: row.apply_url || undefined,
    applicationLinkType: row.application_link_type || undefined,
    verificationStatus: row.verification_status || "UNVERIFIED",
    verificationNote: row.verification_note || undefined,
    ppoClaim: row.ppo_claim || undefined,
    ctcClaim: row.ctc_claim ? (typeof row.ctc_claim === "string" ? JSON.parse(row.ctc_claim) : row.ctc_claim) : undefined,
    isPossiblyClosed: Boolean(row.is_possibly_closed),
    isExternalApplication: Boolean(row.is_external_application),
    sourceMetadata: row.source_metadata ? (typeof row.source_metadata === "string" ? JSON.parse(row.source_metadata) : row.source_metadata) : undefined,
  };
}

function mapResumeRow(row: QueryResultRow): Resume {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    isPrimary: Boolean(row.is_primary),
    filePath: row.file_path || undefined,
    storageKey: row.storage_key || undefined,
    storageProvider: row.storage_provider || "local",
    uploadedAt: row.uploaded_at || "Just now",
  };
}

function mapApplicationRow(row: QueryResultRow, job?: Job, candidate?: Candidate): Application {
  return {
    id: row.id,
    jobId: row.job_id,
    candidateId: row.candidate_id,
    status: row.status,
    referenceNumber: row.reference_number,
    resumeId: row.resume_id,
    resumeName: row.resume_name,
    answers: typeof row.answers === "object" && row.answers !== null ? row.answers : typeof row.answers === "string" ? JSON.parse(row.answers) : {},
    appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : new Date().toISOString(),
    appliedDateFormatted: row.applied_date_formatted || "Applied recently",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    job,
    candidate,
  };
}

// -----------------------------------------------------------------------------
// PostgreSQL Candidate Repository
// -----------------------------------------------------------------------------

export class PostgresCandidateRepository implements CandidateRepository {
  async getById(id: string): Promise<Candidate | null> {
    const res = await query(
      `SELECT c.*, ei.provider_user_id AS ai_tathastu_id
       FROM candidates c
       LEFT JOIN external_identities ei ON ei.candidate_id = c.id AND ei.provider = 'aitathastu'
       WHERE c.id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return mapCandidateRow(res.rows[0]);
  }

  async getByTathastuId(tathastuId: string): Promise<Candidate | null> {
    const res = await query(
      `SELECT c.*, ei.provider_user_id AS ai_tathastu_id
       FROM candidates c
       JOIN external_identities ei ON ei.candidate_id = c.id AND ei.provider = 'aitathastu'
       WHERE ei.provider_user_id = $1`,
      [tathastuId]
    );
    if (res.rows.length === 0) return null;
    return mapCandidateRow(res.rows[0], tathastuId);
  }

  async create(data: {
    aiTathastuId: string;
    name: string;
    email: string;
    avatar?: string;
  }): Promise<Candidate> {
    const candidateId = `cand_${randomUUID()}`;
    const initialCandidate: Candidate = {
      id: candidateId,
      aiTathastuId: data.aiTathastuId,
      name: data.name,
      email: data.email,
      phone: "+91 98765 00000",
      location: "Bengaluru, India",
      headline: "Aspiring Software Engineer",
      avatar: data.avatar || "/images/avatar-rohan.jpg",
      skills: ["React", "TypeScript", "JavaScript"],
      experience: [],
      education: [
        {
          id: `edu_${randomUUID()}`,
          institution: "Technological Institute",
          degree: "B.Tech",
          field: "Computer Science",
          startYear: "2021",
          endYear: "2025",
        },
      ],
      projects: [],
      preferences: {
        targetRole: "Software Engineer",
        preferredLocation: "Bengaluru",
        workArrangement: "Hybrid",
      },
      erisScore: 85,
      profileCompletionPercentage: 55,
    };
    initialCandidate.profileCompletionPercentage = calculateProfileCompletion(initialCandidate);

    return await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO candidates (
           id, name, headline, email, phone, location, avatar, bio,
           skills, education, experience, projects, preferences,
           eris_score, profile_completion_percentage, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
        [
          initialCandidate.id,
          initialCandidate.name,
          initialCandidate.headline,
          initialCandidate.email,
          initialCandidate.phone,
          initialCandidate.location,
          initialCandidate.avatar,
          initialCandidate.bio || "",
          JSON.stringify(initialCandidate.skills),
          JSON.stringify(initialCandidate.education),
          JSON.stringify(initialCandidate.experience),
          JSON.stringify(initialCandidate.projects),
          JSON.stringify(initialCandidate.preferences),
          initialCandidate.erisScore,
          initialCandidate.profileCompletionPercentage,
        ]
      );

      const extId = `ext_${randomUUID()}`;
      await client.query(
        `INSERT INTO external_identities (
           id, candidate_id, provider, provider_user_id, email, created_at, updated_at
         ) VALUES ($1, $2, 'aitathastu', $3, $4, NOW(), NOW())
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [extId, candidateId, data.aiTathastuId, data.email]
      );

      return initialCandidate;
    });
  }

  async update(id: string, updates: Partial<Candidate>): Promise<Candidate> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Candidate not found: ${id}`);
    }

    const merged = { ...existing, ...updates };
    merged.profileCompletionPercentage = calculateProfileCompletion(merged);

    await query(
      `UPDATE candidates SET
         name = $1, headline = $2, email = $3, phone = $4, location = $5,
         avatar = $6, bio = $7, skills = $8, education = $9, experience = $10,
         projects = $11, preferences = $12, eris_score = $13,
         profile_completion_percentage = $14, updated_at = NOW()
       WHERE id = $15`,
      [
        merged.name,
        merged.headline,
        merged.email,
        merged.phone,
        merged.location,
        merged.avatar,
        merged.bio,
        JSON.stringify(merged.skills),
        JSON.stringify(merged.education),
        JSON.stringify(merged.experience),
        JSON.stringify(merged.projects),
        JSON.stringify(merged.preferences),
        merged.erisScore,
        merged.profileCompletionPercentage,
        id,
      ]
    );

    return merged;
  }

  async listAll(): Promise<Candidate[]> {
    const res = await query(
      `SELECT c.*, ei.provider_user_id AS ai_tathastu_id
       FROM candidates c
       LEFT JOIN external_identities ei ON ei.candidate_id = c.id AND ei.provider = 'aitathastu'
       ORDER BY c.created_at ASC`
    );
    return res.rows.map((row) => mapCandidateRow(row));
  }
}

// -----------------------------------------------------------------------------
// PostgreSQL Job Repository
// -----------------------------------------------------------------------------

export class PostgresJobRepository implements JobRepository {
  async list(filter?: JobFilterOptions): Promise<{ jobs: Job[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filter?.q) {
      conditions.push(
        `(LOWER(title) LIKE $${paramIndex} OR LOWER(company) LIKE $${paramIndex} OR LOWER(location) LIKE $${paramIndex} OR LOWER(COALESCE(category, '')) LIKE $${paramIndex} OR LOWER(COALESCE(department, '')) LIKE $${paramIndex})`
      );
      values.push(`%${filter.q.toLowerCase()}%`);
      paramIndex++;
    }

    if (filter?.workArrangement && filter.workArrangement !== "all") {
      conditions.push(`LOWER(work_arrangement) = $${paramIndex}`);
      values.push(filter.workArrangement.toLowerCase());
      paramIndex++;
    }

    if (filter?.employmentType && filter.employmentType !== "all") {
      conditions.push(`LOWER(employment_type) LIKE $${paramIndex}`);
      values.push(`%${filter.employmentType.toLowerCase()}%`);
      paramIndex++;
    }

    if (filter?.category && filter.category !== "all") {
      conditions.push(`(LOWER(COALESCE(category, '')) = $${paramIndex} OR LOWER(COALESCE(department, '')) = $${paramIndex})`);
      values.push(filter.category.toLowerCase());
      paramIndex++;
    }

    if (filter?.verification && filter.verification !== "ALL") {
      conditions.push(`UPPER(verification_status) = $${paramIndex}`);
      values.push(filter.verification.toUpperCase());
      paramIndex++;
    }

    if (filter?.status === "open") {
      conditions.push(`is_possibly_closed = FALSE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) as count FROM jobs ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    let queryText = `SELECT * FROM jobs ${whereClause} ORDER BY created_at DESC`;
    if (filter?.limit && filter.limit > 0) {
      const page = filter.page && filter.page > 0 ? filter.page : 1;
      const offset = (page - 1) * filter.limit;
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(filter.limit, offset);
    }

    const res = await query(queryText, values);
    return {
      jobs: res.rows.map(mapJobRow),
      total,
    };
  }

  async getById(idOrSlug: string): Promise<Job | null> {
    const res = await query(`SELECT * FROM jobs WHERE id = $1 OR slug = $1 LIMIT 1`, [idOrSlug]);
    if (res.rows.length === 0) return null;
    return mapJobRow(res.rows[0]);
  }

  async create(job: Omit<Job, "id" | "postedAt">): Promise<Job> {
    const newJob: Job = {
      ...job,
      id: `job_${randomUUID()}`,
      postedAt: "Just now",
    };

    await query(
      `INSERT INTO jobs (
         id, slug, title, company, company_logo_key, hero_image, location,
         work_arrangement, employment_type, compensation, deadline, department,
         category, overview, requirements, responsibilities, benefits,
         required_skills, optional_skills, min_experience_months, education_requirement,
         is_featured, posted_at, source_job_id, source_platform, graduation_years,
         salary_details, apply_url, application_link_type, verification_status,
         verification_note, ppo_claim, ctc_claim, is_possibly_closed,
         is_external_application, source_metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
         $33, $34, $35, $36, NOW(), NOW()
       )`,
      [
        newJob.id,
        newJob.slug || newJob.id,
        newJob.title,
        newJob.company,
        newJob.companyLogoKey || "default",
        newJob.heroImage || null,
        newJob.location,
        newJob.workArrangement,
        newJob.employmentType,
        newJob.compensation,
        newJob.deadline || null,
        newJob.department || null,
        newJob.category || null,
        newJob.overview || "",
        JSON.stringify(newJob.requirements || []),
        JSON.stringify(newJob.responsibilities || []),
        JSON.stringify(newJob.benefits || []),
        JSON.stringify(newJob.requiredSkills || []),
        JSON.stringify(newJob.optionalSkills || []),
        newJob.minExperienceMonths || 0,
        newJob.educationRequirement || null,
        newJob.isFeatured || false,
        newJob.postedAt,
        newJob.sourceJobId || null,
        newJob.sourcePlatform || null,
        JSON.stringify(newJob.graduationYears || []),
        newJob.salaryDetails ? JSON.stringify(newJob.salaryDetails) : null,
        newJob.applyUrl || null,
        newJob.applicationLinkType || null,
        newJob.verificationStatus || "UNVERIFIED",
        newJob.verificationNote || null,
        newJob.ppoClaim || null,
        newJob.ctcClaim ? JSON.stringify(newJob.ctcClaim) : null,
        newJob.isPossiblyClosed || false,
        newJob.isExternalApplication || false,
        newJob.sourceMetadata ? JSON.stringify(newJob.sourceMetadata) : null,
      ]
    );

    return newJob;
  }

  async upsertBatch(jobs: Job[]): Promise<{ created: number; updated: number; unchanged: number }> {
    let created = 0;
    let updated = 0;
    const unchanged = 0;

    await withTransaction(async (client) => {
      for (const j of jobs) {
        const existing = await client.query(
          `SELECT id FROM jobs WHERE id = $1 OR (LOWER(company) = LOWER($2) AND LOWER(title) = LOWER($3)) LIMIT 1`,
          [j.id, j.company.trim(), j.title.trim()]
        );

        if (existing.rows.length > 0) {
          const targetId = existing.rows[0].id;
          await client.query(
            `UPDATE jobs SET
               slug = $1, title = $2, company = $3, company_logo_key = $4, hero_image = $5,
               location = $6, work_arrangement = $7, employment_type = $8, compensation = $9,
               deadline = $10, department = $11, category = $12, overview = $13,
               requirements = $14, responsibilities = $15, benefits = $16,
               required_skills = $17, optional_skills = $18, min_experience_months = $19,
               education_requirement = $20, is_featured = $21, source_job_id = $22,
               source_platform = $23, graduation_years = $24, salary_details = $25,
               apply_url = $26, application_link_type = $27, verification_status = $28,
               verification_note = $29, ppo_claim = $30, ctc_claim = $31,
               is_possibly_closed = $32, is_external_application = $33,
               source_metadata = $34, updated_at = NOW()
             WHERE id = $35`,
            [
              j.slug || j.id,
              j.title,
              j.company,
              j.companyLogoKey || "default",
              j.heroImage || null,
              j.location,
              j.workArrangement,
              j.employmentType,
              j.compensation,
              j.deadline || null,
              j.department || null,
              j.category || null,
              j.overview || "",
              JSON.stringify(j.requirements || []),
              JSON.stringify(j.responsibilities || []),
              JSON.stringify(j.benefits || []),
              JSON.stringify(j.requiredSkills || []),
              JSON.stringify(j.optionalSkills || []),
              j.minExperienceMonths || 0,
              j.educationRequirement || null,
              j.isFeatured || false,
              j.sourceJobId || null,
              j.sourcePlatform || null,
              JSON.stringify(j.graduationYears || []),
              j.salaryDetails ? JSON.stringify(j.salaryDetails) : null,
              j.applyUrl || null,
              j.applicationLinkType || null,
              j.verificationStatus || "UNVERIFIED",
              j.verificationNote || null,
              j.ppoClaim || null,
              j.ctcClaim ? JSON.stringify(j.ctcClaim) : null,
              j.isPossiblyClosed || false,
              j.isExternalApplication || false,
              j.sourceMetadata ? JSON.stringify(j.sourceMetadata) : null,
              targetId,
            ]
          );
          updated++;
        } else {
          await client.query(
            `INSERT INTO jobs (
               id, slug, title, company, company_logo_key, hero_image, location,
               work_arrangement, employment_type, compensation, deadline, department,
               category, overview, requirements, responsibilities, benefits,
               required_skills, optional_skills, min_experience_months, education_requirement,
               is_featured, posted_at, source_job_id, source_platform, graduation_years,
               salary_details, apply_url, application_link_type, verification_status,
               verification_note, ppo_claim, ctc_claim, is_possibly_closed,
               is_external_application, source_metadata, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
               $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
               $33, $34, $35, $36, NOW(), NOW()
             )`,
            [
              j.id,
              j.slug || j.id,
              j.title,
              j.company,
              j.companyLogoKey || "default",
              j.heroImage || null,
              j.location,
              j.workArrangement,
              j.employmentType,
              j.compensation,
              j.deadline || null,
              j.department || null,
              j.category || null,
              j.overview || "",
              JSON.stringify(j.requirements || []),
              JSON.stringify(j.responsibilities || []),
              JSON.stringify(j.benefits || []),
              JSON.stringify(j.requiredSkills || []),
              JSON.stringify(j.optionalSkills || []),
              j.minExperienceMonths || 0,
              j.educationRequirement || null,
              j.isFeatured || false,
              j.postedAt || "Recently",
              j.sourceJobId || null,
              j.sourcePlatform || null,
              JSON.stringify(j.graduationYears || []),
              j.salaryDetails ? JSON.stringify(j.salaryDetails) : null,
              j.applyUrl || null,
              j.applicationLinkType || null,
              j.verificationStatus || "UNVERIFIED",
              j.verificationNote || null,
              j.ppoClaim || null,
              j.ctcClaim ? JSON.stringify(j.ctcClaim) : null,
              j.isPossiblyClosed || false,
              j.isExternalApplication || false,
              j.sourceMetadata ? JSON.stringify(j.sourceMetadata) : null,
            ]
          );
          created++;
        }
      }
    });

    return { created, updated, unchanged };
  }

  async count(): Promise<number> {
    const res = await query(`SELECT COUNT(*) as count FROM jobs`);
    return parseInt(res.rows[0].count, 10);
  }
}

// -----------------------------------------------------------------------------
// PostgreSQL Application Repository (ACID submission, atomic duplicate checks)
// -----------------------------------------------------------------------------

export class PostgresApplicationRepository implements ApplicationRepository {
  async listByCandidate(candidateId: string): Promise<Application[]> {
    const res = await query(
      `SELECT a.*,
              j.title as job_title, j.company as job_company, j.company_logo_key as job_company_logo_key,
              j.location as job_location, j.compensation as job_compensation, j.employment_type as job_employment_type,
              j.work_arrangement as job_work_arrangement, j.is_possibly_closed as job_is_possibly_closed,
              c.name as candidate_name, c.email as candidate_email, c.avatar as candidate_avatar
       FROM applications a
       LEFT JOIN jobs j ON j.id = a.job_id
       LEFT JOIN candidates c ON c.id = a.candidate_id
       WHERE a.candidate_id = $1
       ORDER BY a.applied_at DESC`,
      [candidateId]
    );

    return res.rows.map((row) => {
      const job = row.job_title
        ? ({
            id: row.job_id,
            title: row.job_title,
            company: row.job_company,
            companyLogoKey: row.job_company_logo_key || "default",
            location: row.job_location,
            compensation: row.job_compensation,
            employmentType: row.job_employment_type,
            workArrangement: row.job_work_arrangement,
            isPossiblyClosed: Boolean(row.job_is_possibly_closed),
          } as unknown as Job)
        : undefined;

      const cand = row.candidate_name
        ? ({
            id: row.candidate_id,
            name: row.candidate_name,
            email: row.candidate_email,
            avatar: row.candidate_avatar,
          } as unknown as Candidate)
        : undefined;

      return mapApplicationRow(row, job, cand);
    });
  }

  async listAll(): Promise<Application[]> {
    const res = await query(
      `SELECT a.*,
              j.title as job_title, j.company as job_company, j.company_logo_key as job_company_logo_key,
              j.location as job_location, j.compensation as job_compensation, j.employment_type as job_employment_type,
              j.work_arrangement as job_work_arrangement, j.is_possibly_closed as job_is_possibly_closed,
              c.name as candidate_name, c.email as candidate_email, c.avatar as candidate_avatar
       FROM applications a
       LEFT JOIN jobs j ON j.id = a.job_id
       LEFT JOIN candidates c ON c.id = a.candidate_id
       ORDER BY a.applied_at DESC`
    );

    return res.rows.map((row) => {
      const job = row.job_title
        ? ({
            id: row.job_id,
            title: row.job_title,
            company: row.job_company,
            companyLogoKey: row.job_company_logo_key || "default",
            location: row.job_location,
            compensation: row.job_compensation,
            employmentType: row.job_employment_type,
            workArrangement: row.job_work_arrangement,
            isPossiblyClosed: Boolean(row.job_is_possibly_closed),
          } as unknown as Job)
        : undefined;

      const cand = row.candidate_name
        ? ({
            id: row.candidate_id,
            name: row.candidate_name,
            email: row.candidate_email,
            avatar: row.candidate_avatar,
          } as unknown as Candidate)
        : undefined;

      return mapApplicationRow(row, job, cand);
    });
  }

  async getByReference(ref: string, candidateId?: string): Promise<Application | null> {
    const conditions = [`(a.reference_number = $1 OR a.id = $1)`];
    const params: unknown[] = [ref];
    if (candidateId) {
      conditions.push(`a.candidate_id = $2`);
      params.push(candidateId);
    }

    const res = await query(
      `SELECT a.*,
              j.title as job_title, j.company as job_company, j.company_logo_key as job_company_logo_key,
              j.location as job_location, j.compensation as job_compensation, j.employment_type as job_employment_type,
              j.work_arrangement as job_work_arrangement, j.is_possibly_closed as job_is_possibly_closed,
              c.name as candidate_name, c.email as candidate_email, c.avatar as candidate_avatar
       FROM applications a
       LEFT JOIN jobs j ON j.id = a.job_id
       LEFT JOIN candidates c ON c.id = a.candidate_id
       WHERE ${conditions.join(" AND ")}
       LIMIT 1`,
      params
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const job = row.job_title
      ? ({
          id: row.job_id,
          title: row.job_title,
          company: row.job_company,
          companyLogoKey: row.job_company_logo_key || "default",
          location: row.job_location,
          compensation: row.job_compensation,
          employmentType: row.job_employment_type,
          workArrangement: row.job_work_arrangement,
          isPossiblyClosed: Boolean(row.job_is_possibly_closed),
        } as unknown as Job)
      : undefined;

    const cand = row.candidate_name
      ? ({
          id: row.candidate_id,
          name: row.candidate_name,
          email: row.candidate_email,
          avatar: row.candidate_avatar,
        } as unknown as Candidate)
      : undefined;

    return mapApplicationRow(row, job, cand);
  }

  async checkDuplicate(candidateId: string, jobId: string): Promise<Application | null> {
    const res = await query(
      `SELECT a.*,
              j.title as job_title, j.company as job_company, j.company_logo_key as job_company_logo_key,
              j.location as job_location, j.compensation as job_compensation, j.employment_type as job_employment_type,
              j.work_arrangement as job_work_arrangement, j.is_possibly_closed as job_is_possibly_closed,
              c.name as candidate_name, c.email as candidate_email, c.avatar as candidate_avatar
       FROM applications a
       LEFT JOIN jobs j ON j.id = a.job_id
       LEFT JOIN candidates c ON c.id = a.candidate_id
       WHERE a.candidate_id = $1 AND a.job_id = $2
       LIMIT 1`,
      [candidateId, jobId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const job = row.job_title
      ? ({
          id: row.job_id,
          title: row.job_title,
          company: row.job_company,
          companyLogoKey: row.job_company_logo_key || "default",
          location: row.job_location,
          compensation: row.job_compensation,
          employmentType: row.job_employment_type,
          workArrangement: row.job_work_arrangement,
          isPossiblyClosed: Boolean(row.job_is_possibly_closed),
        } as unknown as Job)
      : undefined;

    const cand = row.candidate_name
      ? ({
          id: row.candidate_id,
          name: row.candidate_name,
          email: row.candidate_email,
          avatar: row.candidate_avatar,
        } as unknown as Candidate)
      : undefined;

    return mapApplicationRow(row, job, cand);
  }

  async submit(submission: {
    jobId: string;
    candidateId: string;
    resumeId: string;
    answers: Record<string, string>;
  }): Promise<{ success: boolean; application?: Application; error?: string }> {
    return await withTransaction(async (client) => {
      // 1. Verify Job existence and status
      const jobRes = await client.query(`SELECT * FROM jobs WHERE id = $1 FOR SHARE`, [
        submission.jobId,
      ]);
      if (jobRes.rows.length === 0) {
        return { success: false, error: "Job listing not found." };
      }
      const job = mapJobRow(jobRes.rows[0]);
      if (job.isPossiblyClosed) {
        return {
          success: false,
          error:
            "This job listing is marked as closed or expired on the source platform and is no longer accepting new applications.",
        };
      }

      // 2. Verify Candidate existence
      const candRes = await client.query(`SELECT * FROM candidates WHERE id = $1`, [
        submission.candidateId,
      ]);
      if (candRes.rows.length === 0) {
        return { success: false, error: "Candidate not found." };
      }
      const candidate = mapCandidateRow(candRes.rows[0]);

      // 3. Atomically check for duplicate application
      const dupRes = await client.query(
        `SELECT * FROM applications WHERE candidate_id = $1 AND job_id = $2`,
        [submission.candidateId, submission.jobId]
      );
      if (dupRes.rows.length > 0) {
        const existing = mapApplicationRow(dupRes.rows[0], job, candidate);
        return {
          success: false,
          error: `You have already submitted an application for this role (${existing.referenceNumber}).`,
          application: existing,
        };
      }

      // 4. Resolve Resume metadata
      const resumeRes = await client.query(
        `SELECT * FROM resumes WHERE id = $1 AND candidate_id = $2`,
        [submission.resumeId, submission.candidateId]
      );
      const resume = resumeRes.rows.length > 0 ? mapResumeRow(resumeRes.rows[0]) : null;
      const resumeName = resume?.fileName || "Candidate_Resume.pdf";

      // 5. Generate unique reference: AVS-YYYY-MMDD-XXXX
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const rand = Math.floor(1000 + Math.random() * 9000);
      const referenceNumber = `AVS-${year}-${month}${day}-${rand}`;

      const appId = `app_${randomUUID()}`;
      const nowIso = now.toISOString();

      await client.query(
        `INSERT INTO applications (
           id, job_id, candidate_id, status, reference_number,
           resume_id, resume_name, answers, applied_at,
           applied_date_formatted, updated_at
         ) VALUES ($1, $2, $3, 'Under Review', $4, $5, $6, $7, NOW(), 'Applied today', NOW())`,
        [
          appId,
          submission.jobId,
          submission.candidateId,
          referenceNumber,
          submission.resumeId,
          resumeName,
          JSON.stringify(submission.answers || {}),
        ]
      );

      const createdApp: Application = {
        id: appId,
        referenceNumber,
        jobId: submission.jobId,
        candidateId: submission.candidateId,
        resumeId: submission.resumeId,
        resumeName,
        status: "Under Review",
        answers: submission.answers || {},
        appliedAt: nowIso,
        appliedDateFormatted: "Applied today",
        updatedAt: nowIso,
        job,
        candidate,
      };

      return {
        success: true,
        application: createdApp,
      };
    });
  }
}

// -----------------------------------------------------------------------------
// PostgreSQL Saved Jobs Repository
// -----------------------------------------------------------------------------

export class PostgresSavedJobRepository implements SavedJobRepository {
  async listByCandidate(candidateId: string): Promise<string[]> {
    const res = await query(
      `SELECT job_id FROM saved_jobs WHERE candidate_id = $1 ORDER BY created_at DESC`,
      [candidateId]
    );
    return res.rows.map((r) => r.job_id);
  }

  async toggle(candidateId: string, jobId: string): Promise<{ isSaved: boolean }> {
    return await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2`,
        [candidateId, jobId]
      );

      if (existing.rows.length > 0) {
        await client.query(`DELETE FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2`, [
          candidateId,
          jobId,
        ]);
        return { isSaved: false };
      } else {
        const id = `save_${randomUUID()}`;
        await client.query(
          `INSERT INTO saved_jobs (id, candidate_id, job_id, created_at) VALUES ($1, $2, $3, NOW())`,
          [id, candidateId, jobId]
        );
        return { isSaved: true };
      }
    });
  }

  async isSaved(candidateId: string, jobId: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2 LIMIT 1`,
      [candidateId, jobId]
    );
    return res.rows.length > 0;
  }
}

// -----------------------------------------------------------------------------
// PostgreSQL Resume Repository
// -----------------------------------------------------------------------------

export class PostgresResumeRepository implements ResumeRepository {
  async listByCandidate(candidateId: string): Promise<Resume[]> {
    const res = await query(
      `SELECT * FROM resumes WHERE candidate_id = $1 ORDER BY created_at DESC`,
      [candidateId]
    );
    return res.rows.map(mapResumeRow);
  }

  async getById(id: string): Promise<Resume | null> {
    const res = await query(`SELECT * FROM resumes WHERE id = $1 LIMIT 1`, [id]);
    if (res.rows.length === 0) return null;
    return mapResumeRow(res.rows[0]);
  }

  async create(
    resume: Omit<Resume, "id" | "uploadedAt">,
    candidateId: string
  ): Promise<Resume> {
    const newId = `res_${randomUUID()}`;
    const effectiveCandidateId = candidateId || resume.candidateId;

    return await withTransaction(async (client) => {
      if (resume.isPrimary) {
        await client.query(
          `UPDATE resumes SET is_primary = FALSE WHERE candidate_id = $1`,
          [effectiveCandidateId]
        );
      }

      await client.query(
        `INSERT INTO resumes (
           id, candidate_id, file_name, file_size, is_primary,
           file_path, storage_provider, storage_key, uploaded_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Just now', NOW(), NOW())`,
        [
          newId,
          effectiveCandidateId,
          resume.fileName,
          resume.fileSize,
          Boolean(resume.isPrimary),
          resume.filePath || null,
          resume.storageProvider || "local",
          resume.storageKey || null,
        ]
      );

      const created: Resume = {
        ...resume,
        id: newId,
        candidateId: effectiveCandidateId,
        uploadedAt: "Just now",
      };
      return created;
    });
  }

  async setPrimary(id: string, candidateId: string): Promise<Resume | null> {
    return await withTransaction(async (client) => {
      await client.query(
        `UPDATE resumes SET is_primary = FALSE WHERE candidate_id = $1`,
        [candidateId]
      );
      const res = await client.query(
        `UPDATE resumes SET is_primary = TRUE, updated_at = NOW() WHERE id = $1 AND candidate_id = $2 RETURNING *`,
        [id, candidateId]
      );
      if (res.rows.length === 0) return null;
      return mapResumeRow(res.rows[0]);
    });
  }

  async delete(id: string, candidateId: string): Promise<boolean> {
    const res = await query(
      `DELETE FROM resumes WHERE id = $1 AND candidate_id = $2 RETURNING id`,
      [id, candidateId]
    );
    return res.rows.length > 0;
  }
}

// -----------------------------------------------------------------------------
// PostgreSQL Audit Repository
// -----------------------------------------------------------------------------

export class PostgresAuditRepository implements AuditRepository {
  async logEvent(event: {
    actorType: "candidate" | "admin" | "system";
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    const id = `audit_${randomUUID()}`;
    await query(
      `INSERT INTO audit_events (
         id, actor_type, actor_id, action, resource_type,
         resource_id, metadata, ip_address, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        event.actorType,
        event.actorId,
        event.action,
        event.resourceType,
        event.resourceId || null,
        JSON.stringify(event.metadata || {}),
        event.ipAddress || null,
      ]
    );
  }

  async listRecent(limit = 50): Promise<unknown[]> {
    const res = await query(
      `SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}
