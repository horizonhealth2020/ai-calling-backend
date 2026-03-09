import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true, service: "ops-api" }));
app.use("/api", routes);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`ops-api listening on ${port}`));
