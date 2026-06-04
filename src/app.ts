import express, { Application, Request, Response, NextFunction, urlencoded } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import router from "./routes";
import path from "path";

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
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api", router);


export default app;