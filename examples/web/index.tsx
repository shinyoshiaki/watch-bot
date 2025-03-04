import type { FC } from "react";
import { createRoot } from "react-dom/client";
import { useRef, useState } from "react";
import {
  JsonRpcClient,
  websocketAdapter,
} from "@shinyoshiaki/json-rpc/src/index.js";
import type {
  FunctionFrontCall,
  FunctionFrontCallResponseWhip,
  FunctionFrontNegotiation,
  FunctionFrontNegotiationPayloadWhip,
  FunctionSensorAdd,
  FunctionSensorAddResponse,
  FunctionSensorNegotiation,
} from "../../packages/service/src/schema.js";

const defaultUserId = process.env.USER_ID ?? "";
// const endpoint = process.env.SERVICE_ENDPOINT ?? "ws://localhost:3001";
const endpoint = "ws://localhost:3001";

const NEST_CLIENT_ID = process.env.NEST_CLIENT_ID;
const NEST_CLIENT_SECRET = process.env.NEST_CLIENT_SECRET;
const NEST_PROJECT_ID = process.env.NEST_PROJECT_ID;
const NEST_REFRESH_TOKEN = process.env.NEST_REFRESH_TOKEN;
const RING_REFRESH_TOKEN = process.env.RING_REFRESH_TOKEN;

const App: FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [userId, setUserId] = useState<string>(
    defaultUserId.length > 0
      ? defaultUserId
      : "web_browser_" + Math.random().toString(36).slice(-8),
  );
  const [inputSensorId, setSensorId] = useState<string>(
    Math.random().toString(36).slice(-8),
  );

  const call = async () => {
    const pc = new RTCPeerConnection();
    pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        audioRef.current!.srcObject = new MediaStream([e.track]);
        audioRef.current!.play();
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const [audio] = stream.getAudioTracks();

    pc.addTrack(audio, stream);

    const candidates: RTCIceCandidate[] = [];
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        candidates.push(candidate);
        if (pc.remoteDescription) {
          for (const c of candidates) {
            const payload: FunctionFrontNegotiationPayloadWhip = c.toJSON();
            rpc.call("front_negotiation", {
              userId,
              payload,
            } as FunctionFrontNegotiation);
          }
        }
      }
    };
    const ws = new WebSocket(endpoint);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const rpc = new JsonRpcClient(...websocketAdapter(ws));
    const frontCall: FunctionFrontCall = {
      sensors: {
        nest:
          NEST_CLIENT_ID &&
          NEST_CLIENT_SECRET &&
          NEST_PROJECT_ID &&
          NEST_REFRESH_TOKEN
            ? {
                clientId: NEST_CLIENT_ID,
                clientSecret: NEST_CLIENT_SECRET,
                projectId: NEST_PROJECT_ID,
                refreshToken: NEST_REFRESH_TOKEN,
              }
            : undefined,
        ring: RING_REFRESH_TOKEN
          ? { refreshToken: RING_REFRESH_TOKEN }
          : undefined,
      },
      userId,
      offer: offer.sdp!,
      frontDevice: "whip",
    };
    const answer = await rpc.call<FunctionFrontCallResponseWhip>(
      "front_call",
      frontCall,
    );
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
  };

  const inputDevice = async () => {
    const pc = new RTCPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    const [audio] = stream.getAudioTracks();
    const [video] = stream.getVideoTracks();

    pc.addTrack(audio, stream);
    pc.addTrack(video, stream);

    const candidates: RTCIceCandidate[] = [];
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        candidates.push(candidate);
        if (pc.remoteDescription) {
          for (const c of candidates) {
            const message: FunctionSensorNegotiation = {
              sensorId: inputSensorId,
              userId,
              payload: c.toJSON(),
            };
            rpc.call("sensor_negotiation", message);
          }
        }
      }
    };
    const ws = new WebSocket(endpoint);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const rpc = new JsonRpcClient(...websocketAdapter(ws));
    const frontCall: FunctionSensorAdd = {
      sensor: {
        whip: [
          {
            id: inputSensorId,
            offer: pc.localDescription?.sdp!,
          },
        ],
      },
      userId,
    };
    const [{ negotiation }] = await rpc.call<FunctionSensorAddResponse>(
      "sensor_add",
      frontCall,
    );

    await pc.setRemoteDescription({ type: "answer", sdp: negotiation });
  };

  return (
    <div>
      <div>
        <p>user id</p>
        <input
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
          }}
          placeholder="user id"
        />
      </div>
      <div>
        <p>input sensor</p>
        <span>sensorId </span>
        <input
          value={inputSensorId}
          onChange={(e) => {
            setSensorId(e.target.value);
          }}
          placeholder="port"
        />
        <button onClick={inputDevice}>input</button>
      </div>
      <div>
        <p>call to agent</p>
        <audio controls autoPlay ref={audioRef} />
        <button onClick={call}>call</button>
      </div>
      <br />
    </div>
  );
};

const container = document.getElementById("app")!;
const root = createRoot(container);
root.render(<App />);
