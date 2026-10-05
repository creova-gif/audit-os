import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { isOriginAllowed, parseCorsAllowlist } from "./lib/ai-guard";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const corsAllowlist = parseCorsAllowlist(process.env.CORS_ALLOWED_ORIGINS);
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin, corsAllowlist));
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
