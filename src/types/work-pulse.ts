export type WorkPulseStatus = "in_progress" | "blocked" | "completed";
export type AvailabilityStatus = "available" | "busy" | "focused" | "away";

export interface WorkPulseEntry {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: WorkPulseStatus;
  startedAt: string;
  estimatedEndAt: string | null;
}

export interface WorkPulseStaff {
  userId: string;
  displayName: string | null;
  username: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  availability: AvailabilityStatus;
  activeEntries: WorkPulseEntry[];
}

