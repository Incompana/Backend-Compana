export interface AssessmentAnswer {
  question: string;
  answer: string;
}

export interface AssessmentPayload {
  targetRole: string;
  answers: AssessmentAnswer[];
  currentLevel?: string;
  problemCategory?: string;
  blockerType?: string;
  maxQuestions?: number;
}

export type AiQuestion = {
  question_id: string;
  skill_id?: string;
  question?: string;
  prompt?: string;
  category?: string;
  expected_keywords?: string;
  difficulty?: string;
  answer_type?: string;
  options?: string;
  target_role?: string;
  current_level?: string;
  blocker_type?: string;
  domain_interest?: string;
  question_score?: number;
};

export type AiSubmitAssessmentResponse = {
  input?: unknown;
  assessment_questions?: AiQuestion[];
  assessment_answers?: unknown[];
  scored_answers?: unknown[];
  skill_profile?: unknown;
  validated_context?: {
    validated_analysis?: {
      target_role?: string;
      current_level?: string;
      problem_category?: string;
      blocker_type?: string | null;
      persona_type?: string | null;
      confidence_score?: number;
      summary?: string;
    };
    user_skill_profile?: Record<string, number>;
  };
  skill_gap?: {
    target_role?: string;
    skill_gap_summary?: {
      missing_count?: number;
      weak_count?: number;
      owned_count?: number;
    };
    missing_skills?: Array<{
      skill_id: string;
      skill_name: string;
      priority?: string;
      step_order?: number;
      prerequisite_skill_id?: string;
      status?: string;
      score?: number;
      progress?: number;
      reason?: string;
      evidence?: string[];
      next_task_id?: string;
    }>;
    weak_skills?: unknown[];
    owned_skills?: unknown[];
    readiness_score?: number;
    priority_gap?: string | null;
    blocker_type?: string | null;
    problem_category?: string;
  };
  action_plan?: {
    recommended_tasks?: Array<{
      task_id: string;
      task_title: string;
      task_description: string;
      target_skill?: string;
      reason?: string;
      duration_estimate?: string;
      difficulty?: string;
      output_format?: string;
      learning_focus?: string;
      task_steps?: string;
      assessment_checklist?: string;
      reference_keywords?: string;
      task_score?: number;
    }>;
  };
};