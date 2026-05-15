import express, { Application, Request, Response, NextFunction, urlencoded } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mainApiRouter from "./routes";

const app: Application = express();

// CORS configuration for credentials
const corsOptions = {
  credentials: true,
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
};

app.use(cors(corsOptions));
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

export default app;