import type { FC } from "react";
import { createRoot } from "react-dom/client";
import { WhipSender } from "@werift/whip";
import { useRef, useState } from "react";

const App: FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [inputPort, setInputPort] = useState<string>("9999");

  const call = async () => {
    const url = "http://localhost:3001/whip";
    const whip = new WhipSender();
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

    await whip.publish(pc, url);
  };

  const inputDevice = async () => {
    const url = `http://localhost:${Number(inputPort)}/whip`;
    const whip = new WhipSender();
    const pc = new RTCPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    const [audio] = stream.getAudioTracks();
    const [video] = stream.getVideoTracks();

    pc.addTrack(audio, stream);
    pc.addTrack(video, stream);

    await whip.publish(pc, url);
  };

  return (
    <div>
      <div>
        <p>input sensor</p>
        <input
          value={inputPort}
          onChange={(e) => {
            setInputPort(e.target.value);
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
