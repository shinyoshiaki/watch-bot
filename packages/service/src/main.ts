import { serve } from "@hono/node-server";
import { GoogleAuth } from "google-auth-library";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocketServer } from "ws";
import { createSession } from "./domain/session.js";
import type { Session } from "./import/core.js";
import {
  type JsonRpcRequest,
  JsonRpcServer,
  parseErrorResponse,
  tryWith,
} from "./import/rpc.js";
import type {
  FunctionFrontCall,
  FunctionFrontNegotiation,
  FunctionSensorAdd,
  FunctionSensorAddResponse,
  FunctionSensorNegotiation,
} from "./schema.js";

console.log(Object.keys(process.env));

const { CLOUD_RUN_PROJECT_ID, GEMINI_KEY, VERTEX } = process.env;

const app = new Hono();
app.use("/*", cors());

const server = serve({ fetch: app.fetch, port: 3001 });

const sessions = new Map<string, Session>();

const findOrCreateSession = async ({
  userId,
  sensors,
  frontDevice,
}: {
  userId: string;
  sensors?: FunctionFrontCall["sensors"];
  frontDevice?: FunctionFrontCall["frontDevice"];
}) => {
  const gemini =
    VERTEX === "true"
      ? await (async () => {
          const project = CLOUD_RUN_PROJECT_ID!;
          const location = "us-central1";
          const version = "v1beta1";
          const auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          });
          const client = await auth.getApplicationDefault();
          const token = await client.credential.getAccessToken();
          console.log("check auth", token.token?.length);
          return {
            llmApiKey: token.token!,
            options: {
              vertex: { location, version },
              model: `projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash-exp`,
            },
          };
        })()
      : { llmApiKey: GEMINI_KEY! };

  const session =
    sessions.get(userId) ??
    createSession({
      id: userId,
      sensors: sensors ?? {},
      frontDevice,
      ...gemini,
    });
  sessions.set(session.id, session);
  return session;
};

const rpcServer = new JsonRpcServer();
rpcServer.registerMethod(
  "front_call",
  async ({
    sensors,
    userId,
    offer,
    frontDevice,
    email,
    name,
  }: FunctionFrontCall) => {
    const session = await findOrCreateSession({ userId, sensors, frontDevice });

    const frontDeviceInstance =
      session.frontDevice ?? session.setFrontDevice(frontDevice);

    const answer = await frontDeviceInstance.handleOffer(offer);
    return answer;
  },
);

rpcServer.registerMethod(
  "front_negotiation",
  async ({ userId, payload }: FunctionFrontNegotiation) => {
    const session = sessions.get(userId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.frontDevice) {
      await session.frontDevice.handleIceCandidate(payload);
    }
    return {};
  },
);

rpcServer.registerMethod(
  "sensor_add",
  async ({ userId, sensor }: FunctionSensorAdd) => {
    const session = await findOrCreateSession({ userId });
    const res: FunctionSensorAddResponse = await session.addSensor(sensor);
    return res;
  },
);

rpcServer.registerMethod(
  "sensor_negotiation",
  async ({ userId, sensorId, payload }: FunctionSensorNegotiation) => {
    const session = sessions.get(userId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sensor = session.sensors.find((s) => s.id === sensorId);
    if (!sensor) {
      throw new Error("Sensor not found");
    }

    const res = await sensor.handleNegotiation(payload);
    return res;
  },
);

const wss = new WebSocketServer({ server: server as any });
wss.on("connection", (ws) => {
  ws.on("message", async (b) => {
    const msg = b.toString();
    const request = tryWith(() => JSON.parse(msg) as JsonRpcRequest);
    if ("error" in request) {
      ws.send(JSON.stringify(parseErrorResponse));
      return;
    }
    const response = await rpcServer.handleRequest(request).catch((error) => {
      console.error(error);
    });
    if (response) {
      ws.send(JSON.stringify(response));
    }
  });
});

console.log("started");
