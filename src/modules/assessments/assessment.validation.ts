import { z } from "zod";

export const assessmentSchema =
  z.object({

    targetRole:
      z.string().min(1),

    answers: z.array(

      z.object({

        question:
          z.string().min(1),

        answer:
          z.string().min(1),

      })

    ).min(1),

  });