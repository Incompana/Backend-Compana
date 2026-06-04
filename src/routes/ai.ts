import { Router, Request, Response } from "express";
import { getAi, getAiServiceUrl, postAi } from "../services/aiService";

const aiRouter = Router();

function forwardError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown AI service error";
  res.status(502).json({
    status: "error",
    message,
  });
}

aiRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    const aiHealth = await getAi("/health");
    res.json({
      status: "ok",
      ai_service_url: getAiServiceUrl(),
      ai: aiHealth,
    });
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.get("/readiness", async (_req: Request, res: Response) => {
  try {
    res.json(await getAi("/readiness"));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.get("/model-status", async (_req: Request, res: Response) => {
  try {
    res.json(await getAi("/model-status"));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.get("/demo/end-to-end", async (_req: Request, res: Response) => {
  try {
    res.json(await getAi("/demo/end-to-end"));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.get("/rubric-taxonomy", async (_req: Request, res: Response) => {
  try {
    res.json(await getAi("/rubric-taxonomy"));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.post("/analyze-pretext", async (req: Request, res: Response) => {
  try {
    res.json(await postAi("/analyze-pretext", req.body));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.post("/select-questions", async (req: Request, res: Response) => {
  try {
    res.json(await postAi("/select-questions", req.body));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.post("/submit-assessment", async (req: Request, res: Response) => {
  try {
    res.json(await postAi("/submit-assessment", req.body));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.post("/evaluate-task", async (req: Request, res: Response) => {
  try {
    res.json(await postAi("/evaluate-task", req.body));
  } catch (error) {
    forwardError(res, error);
  }
});

aiRouter.post("/update-progress", async (req: Request, res: Response) => {
  try {
    res.json(await postAi("/update-progress", req.body));
  } catch (error) {
    forwardError(res, error);
  }
});

export default aiRouter;
