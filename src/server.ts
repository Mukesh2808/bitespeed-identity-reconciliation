import express, { Request, Response, NextFunction } from "express";
import { connectDB } from "./utils/db";
import identifyRoutes from "./routes/identifyRoutes";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ── Middleware ────────────────────────────────────────────────────────
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
});

// ── Routes ───────────────────────────────────────────────────────────
app.use("/", identifyRoutes);

// ── Global error handler ─────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// ── Connect to MongoDB, then start server ────────────────────────────
connectDB().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
});

export default app;
