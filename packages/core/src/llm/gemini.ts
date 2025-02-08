import {
  type RTCDataChannel,
  RTCPeerConnection,
  type RTCRtpCodecParameters,
  useOPUS,
  useVP8,
} from "werift";
import {
  type DataChannelRecvMessage,
  type DataChannelSendMessage,
  type GeminiConfig,
  GeminiWebRTCProxy,
} from "../imports/gemini.js";
import { LLMAgent, type LLMProps as LLMConfig } from "./base.js";

export class GeminiLLM extends LLMAgent {
  private gemini: GeminiWebRTCProxy;
  readonly pc: RTCPeerConnection;

  private dc: RTCDataChannel;

  constructor(
    readonly props: LLMConfig &
      GeminiConfig & { videoCodec?: RTCRtpCodecParameters },
  ) {
    super(props);

    this.pc = new RTCPeerConnection({
      codecs: {
        audio: [useOPUS()],
        video: [props.videoCodec ?? useVP8()],
      },
    });
    this.dc = this.pc.createDataChannel("gemini");

    this.pc.ontrack = ({ track }) => {
      if (track.kind === "audio") {
        track.onReceiveRtp.subscribe((rtp) => {
          if (
            this.unmuteAt == undefined ||
            // unmuteしてから2秒後に再度muteするようにする
            Date.now() - this.unmuteAt > 2000
          ) {
            this.muteInputAudio = true;
          }
          this.onAudio.execute(rtp);
        });
      } else if (track.kind === "video") {
        track.onReceiveRtp.subscribe((rtp) => {
          this.onVideo.execute(rtp);
        });
      }
    };
    this.dc.onmessage = ({ data }) => {
      try {
        if (typeof data === "string") {
          const { streamingText, completeText, call } = JSON.parse(
            data,
          ) as DataChannelRecvMessage;

          if (streamingText != undefined) {
            this.onStreamingText.execute(streamingText);
          }
          if (completeText != undefined) {
            if (completeText === "") {
              this.muteInputAudio = false;
              this.unmuteAt = Date.now();
            }
            this.onCompleteText.execute(completeText);
          }
          if (call != undefined) {
            this.onToolCall.execute(call);
          }
        }
      } catch (error) {}
    };

    this.pc.addTransceiver(this.audioTrack, { direction: "sendrecv" });
    this.pc.addTransceiver(this.videoTrack, { direction: "sendrecv" });
  }

  async start() {
    this.gemini = await GeminiWebRTCProxy.create({
      ...this.props,
      videoCodec: this.props.videoCodec ?? useVP8(),
    });
    this.gemini.onImageSent.subscribe(() => {
      this.onImageSent.execute();
    });

    const offer = await this.pc.createOffer();
    const sdp = await this.pc.setLocalDescription(offer);
    const answer = await this.gemini.handleOffer(sdp.toSdp());
    await this.pc.setRemoteDescription(answer);
  }

  sendCompleteText(text: string): void {
    const message: DataChannelSendMessage = { completeText: text };
    try {
      this.dc.send(JSON.stringify(message));
    } catch (error) {}
  }

  sendToolCallResponse(response: { id: string; response: object }): void {
    console.log("sendToolCallResponse", response);
    try {
      this.dc.send(JSON.stringify({ response } as DataChannelSendMessage));
    } catch (error) {}
  }

  close(): void {
    this.gemini.close();
    this.stopTask();
    this.pc.close();
  }
}
