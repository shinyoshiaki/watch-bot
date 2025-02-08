import { createSession } from "../packages/core/src/session.js";

console.log(Object.keys(process.env));
const {
  GEMINI_KEY,
  CLIENT_ID,
  CLIENT_SECRET,
  REFRESH_TOKEN,
  PROJECT_ID,
  RING_REFRESH_TOKEN,
} = process.env;

createSession({
  accessories: {
    whip: [{ port: 9999 }],
    // nest: {
    //   clientId: CLIENT_ID!,
    //   clientSecret: CLIENT_SECRET!,
    //   projectId: PROJECT_ID!,
    //   refreshToken: REFRESH_TOKEN!,
    // },
    // ring: { refreshToken: RING_REFRESH_TOKEN! },
  },
  frontDevice: { name: "whip", port: 3001 },
  llmApiKey: GEMINI_KEY!,
});
