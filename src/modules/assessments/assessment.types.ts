export interface AssessmentAnswer {
  question: string;
  answer: string;
}

export interface AssessmentPayload {
  targetRole: string;
  answers: AssessmentAnswer[];
}