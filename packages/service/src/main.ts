import { serve } from "@hono/node-server";
import { GoogleAuth } from "google-auth-library";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocketServer } from "ws";
import {
  type FrontDeviceName,
  type Session,
  type SessionAccessory,
  createSession,
} from "./import/core.js";
import {
  type JsonRpcRequest,
  JsonRpcServer,
  parseErrorResponse,
  tryWith,
} from "./import/rpc.js";

console.log(Object.keys(process.env));

const { CLOUD_RUN_PROJECT_ID, GEMINI_KEY } = process.env;

const project = CLOUD_RUN_PROJECT_ID!;
const location = "us-central1";
const version = "v1beta1";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getApplicationDefault();
const token = await client.credential.getAccessToken();

console.log("check auth", token.token?.length);

const app = new Hono();
app.use("/*", cors());

const server = serve({ fetch: app.fetch, port: 3001 });

const sessions = new Map<string, Session>();

const rpcServer = new JsonRpcServer();
rpcServer.registerMethod(
  "offer",
  async ({
    accessories,
    userId,
    offer,
    frontDevice,
  }: {
    userId: string;
    offer: string;
    accessories: SessionAccessory;
    frontDevice: FrontDeviceName;
  }) => {
    const session =
      sessions.get(userId) ??
      createSession({
        id: userId,
        accessories,
        frontDevice: { name: frontDevice },
        llmApiKey: GEMINI_KEY!,
        // llmApiKey: token.token!,
        // options: {
        //   vertex: { location, version },
        //   model: `projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash-exp`,
        // },
      });
    sessions.set(session.id, session);

    const answer = await session.frontDevice.handleOffer(offer);
    return answer;
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
