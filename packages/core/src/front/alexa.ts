import { randomUUID } from "crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { MediaStreamTrack, RTCPeerConnection, type RtpPacket } from "werift";
import { FrontDevice } from "./base.js";

export class AlexaFrontDevice extends FrontDevice {
  static readonly deviceName = "alexa";
  readonly name = randomUUID();
  private readonly track = new MediaStreamTrack({ kind: "audio" });
  private pc!: RTCPeerConnection;

  constructor({ port }: { port?: number }) {
    super();
    if (port != undefined) {
      const app = new Hono();
      app.use("/*", cors());
      app.post("/offer", async (c) => {
        const { sdp } = await c.req.json();
        console.log("alexa offer", sdp);
        const answer = await this.handleOffer(sdp);
        return c.text(answer.answer);
      });

      serve({ fetch: app.fetch, port });
    }
  }

  private createPc() {
    if (this.pc) {
      this.pc.close();
    }

    this.pc = new RTCPeerConnection({ iceUseLinkLocalAddress: true });
    const transceiver = this.pc.addTransceiver(this.track, {
      direction: "sendrecv",
    });
    transceiver.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((rtp) => {
        rtp.header.marker = true;
        this.onAudio.execute(rtp);
      });
    });
    this.pc.onconnectionstatechange = () => {
      console.log("Alexa Connection state changed to", this.pc.connectionState);
    };
  }

  async handleOffer(sdp: string) {
    this.createPc();

    await this.pc.setRemoteDescription({
      type: "offer",
      sdp,
    });
    const answer = await this.pc.setLocalDescription(
      await this.pc.createAnswer(),
    );
    return { answer: answer.toSdp().sdp };
  }

  handleAudio(rtp: RtpPacket) {
    this.track.writeRtp(rtp);
  }

  handleVideo(rtp: RtpPacket): void {}

  async handleIceCandidate(candidate: any): Promise<any> {}
}
