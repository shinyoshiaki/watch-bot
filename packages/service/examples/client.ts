import { JsonRpcClient } from "../../json-rpc/src/index.js";
import { MediaStreamTrack, RTCPeerConnection } from "werift";
import { createMicOpusRTP } from "./mic.js";
import { createOpusSpeaker } from "./speaker.js";
import { randomUUID } from "crypto";
import { JitterBufferCallback } from "werift/nonstandard";

console.log(Object.keys(process.env));

const {
  GEMINI_KEY,
  CLIENT_ID,
  CLIENT_SECRET,
  REFRESH_TOKEN,
  PROJECT_ID,
  RING_REFRESH_TOKEN,
} = process.env;

const nestCredentials = {
  clientId: CLIENT_ID!,
  clientSecret: CLIENT_SECRET!,
  projectId: PROJECT_ID!,
  refreshToken: REFRESH_TOKEN!,
};

const userId = randomUUID();

const pc = new RTCPeerConnection();
pc.onconnectionstatechange = () => {
  console.log("client Connection state changed to", pc.connectionState);
};
const dc = pc.createDataChannel("data");
dc.onmessage = (e) => {
  console.log(e.data);
  // dc.send("world");
};
const audio = new MediaStreamTrack({ kind: "audio" });
const mic = createMicOpusRTP((rtp) => {
  audio.writeRtp(rtp as any);
});
const speaker = createOpusSpeaker();
const jitterBuffer = new JitterBufferCallback(48000);
jitterBuffer.pipe((o) => {
  if (!o.rtp) {
    return;
  }
  speaker.write(o.rtp.payload);
});
pc.ontrack = (e) => {
  if (e.track.kind === "audio") {
    e.track.onReceiveRtp.subscribe((rtp) => {
      jitterBuffer.input({ rtp });
    });
  }
};
pc.addTrack(audio);

const ws = new WebSocket("ws://localhost:3001");

ws.addEventListener("open", async () => {
  console.log("Connected to server");

  const rpcClient = new JsonRpcClient(
    (message: string) => {
      ws.send(message);
    },
    (callback) => {
      ws.addEventListener("message", (data) => {
        callback(data.data.toString());
      });
    },
  );

  const offer = await pc.createOffer();
  const sdp = await pc.setLocalDescription(offer);
  console.log(sdp.toSdp());

  const res = await rpcClient
    .call("offer", {
      userId,
      offer: sdp.toSdp().sdp,
      frontDevice: "whip",
      accessories: {
        // nest: nestCredentials,
        // ring: { refreshToken: RING_REFRESH_TOKEN! },
      },
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
  console.log("res", res);
  const { answer } = res;
  console.log(answer);
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  mic.start();
});

ws.addEventListener("close", () => {
  console.log("Disconnected from server");
});
