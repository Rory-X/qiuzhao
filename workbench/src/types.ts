export type Tier = "A" | "B" | "C";

export type ApplicationStatus =
  | "watch"
  | "applied"
  | "assess"
  | "oa"
  | "ai"
  | "tech"
  | "hr"
  | "offer"
  | "reject";

export interface Application {
  id: string;
  company: string;
  role: string;
  tier: Tier;
  track: string;
  status: ApplicationStatus;
  source: string;
  verify: "pending" | "verified" | "offline";
  resume: string;
  nextAction: string;
  nextDate: string;
  location?: string;
  deadline?: string;
  score?: number;
  appliedAt?: string;
  note?: string;
  url?: string;
  logo?: string;
}

export interface WorkbenchTask {
  id: string;
  title: string;
  detail: string;
  date: string;
  time: string;
  done: boolean;
  createdAt: string;
}

export interface InterviewScores {
  project: number;
  system: number;
  communication: number;
}

export interface InterviewSession {
  id: string;
  applicationId?: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  focus: string;
  question?: string;
  status: "planned" | "completed";
  notes: string;
  strengths: string;
  gaps: string;
  scores?: InterviewScores;
  completedAt?: string;
}

export interface WeeklyReview {
  id: string;
  weekKey: string;
  createdAt: string;
  wins: string;
  bottleneck: string;
  nextChange: string;
}

export interface OnboardingState {
  skipped: boolean;
  visited: Page[];
}

export interface WorkbenchState {
  version: number;
  applications: Application[];
  tasks: WorkbenchTask[];
  interviewSessions: InterviewSession[];
  checklists: Record<string, boolean[]>;
  rhythm: Record<string, boolean[]>;
  reviews: WeeklyReview[];
  note: string;
  onboarding: OnboardingState;
  updatedAt: string | null;
}

export interface RhythmPack {
  title: string;
  items: string[];
}

export interface Meta {
  docs: Array<{ id: string; title: string; blurb: string }>;
  checklists: Record<string, { title: string; source: string; items: string[] }>;
  rhythm: Record<string, RhythmPack>;
  host: string;
  port: number;
}

export type Page = "overview" | "radar" | "opportunities" | "pipeline" | "interview" | "experience" | "materials";
