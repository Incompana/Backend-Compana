export interface CreateUserContextPayload {
  userId: string;
  targetRole: string;
  confidenceScore: number;
  keywords: string[];
}