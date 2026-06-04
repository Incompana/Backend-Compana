import { Router } from "express";
import aiRouter from "./ai";

const mainApiRouter = Router();

mainApiRouter.use("/ai", aiRouter);

export default mainApiRouter;
