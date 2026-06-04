import express, { Application, Request, Response, NextFunction, urlencoded } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import mainApiRouter from "./routes";

dotenv.config();

const app: Application = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS configuration for credentials
const corsOptions = {
  credentials: true,
  origin: allowedOrigins,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: "up",
        message: "server is healthy"
    })
});

app.use("/img", express.static("public/img"));
app.use("/api", mainApiRouter);

export default app;
