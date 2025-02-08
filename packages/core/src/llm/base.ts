import type { FunctionDeclaration } from "@google/generative-ai";
import {
  Event,
  MediaStreamTrack,
  type RTCPeerConnection,
  RtpBuilder,
  type RtpPacket,
} from "werift";

export interface LLMProps {
  apiKey: string;
  systemInstruction: string;
  responseModality: "audio" | "text";
  declarations: FunctionDeclaration[];
}

export abstract class LLMAgent {
  readonly onToolCall = new Event<
    [{ name: string; args: object; id: string }]
  >();
  abstract readonly pc: RTCPeerConnection;
  muteInputAudio = false;
  unmuteAt?: number;
  protected videoTrack = new MediaStreamTrack({ kind: "video" });
  protected audioTrack = new MediaStreamTrack({ kind: "audio" });
  task?: string;
  taskStartTime?: number;
  private taskInterval?: any;

  readonly onAudio = new Event<[RtpPacket]>();
  readonly onVideo = new Event<[RtpPacket]>();
  readonly onStreamingText = new Event<[string]>();
  readonly onCompleteText = new Event<[string]>();
  readonly onImageSent = new Event();
  readonly builder = new RtpBuilder({ between: 20, clockRate: 48000 });

  constructor(protected props: LLMProps) {}

  abstract start(): Promise<void>;

  sendAudio(rtp: RtpPacket) {
    const p = this.builder.create(rtp.payload);
    this.audioTrack.writeRtp(p);
  }

  sendVideo(rtp: RtpPacket) {
    this.videoTrack.writeRtp(rtp);
  }

  abstract sendCompleteText(text: string): void;

  abstract sendToolCallResponse(response: {
    id: string;
    response: object;
  }): void;

  updateTask(task: string) {
    this.stopTask();

    this.task = task;
    this.taskStartTime = Date.now();
    this.sendCompleteText(this.task);
    this.taskInterval = setInterval(() => {
      if (this.task) {
        this.sendCompleteText(this.task);
      }
    }, 2000);
  }

  stopTask() {
    clearInterval(this.taskInterval);
    this.taskInterval = undefined;
    this.task = undefined;
    this.taskStartTime = undefined;
  }

  abstract close(): void;
}
