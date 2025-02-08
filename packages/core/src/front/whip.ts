import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
// import {
//   MediaStreamTrack,
//   RTCPeerConnection,
//   type RtpPacket,
// } from "../imports/werift.js";
import { MediaStreamTrack, RTCPeerConnection, type RtpPacket } from "werift";
import { WhipReceiver } from "../imports/wish.js";
import { FrontDevice } from "./base.js";

export class WHIPFrontDevice extends FrontDevice {
  static readonly deviceName = "whip";
  readonly name = WHIPFrontDevice.deviceName;
  private track = new MediaStreamTrack({ kind: "audio" });
  private pc = new RTCPeerConnection({ iceUseLinkLocalAddress: true });
  private session: WhipReceiver;

  constructor({ port }: { port?: number }) {
    super();

    if (port != undefined) {
      const app = new Hono();
      app.use(
        "/*",
        cors({
          origin: "*",
          allowHeaders: ["Content-Type", "If-Match", "Location"],
          exposeHeaders: ["Content-Type", "If-Match", "Location"],
        }),
      );

      app.post("/whip", async (c) => {
        try {
          const sdp = await c.req.text();
          const { answer, etag } = await this.handleOffer(sdp);

          return c.body(answer, 201, {
            "Content-Type": "application/sdp",
            Location: "/whip",
            ETag: etag,
          });
        } catch (error) {
          console.error(error);
          c.status(500);
          return c.body("Internal Server Error");
        }
      });
      app.patch("/whip", async (c) => {
        try {
          const candidate = await c.req.text();
          const etag = c.req.header("If-Match")!;
          await this.handleIceCandidate({ candidate, etag });

          c.status(204);
          return c.body(null);
        } catch (error) {
          console.error(error);
          c.status(500);
          return c.body("Internal Server Error");
        }
      });

      serve({ fetch: app.fetch, port });
    }
  }

  private createSession() {
    this.pc.ondatachannel = ({ channel }) => {
      // setInterval(() => {
      //   channel.send("hello");
      // }, 1000);
      channel.onmessage = (e) => {
        console.log(e.data);
      };
    };
    this.pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        e.track.onReceiveRtp.subscribe((rtp) => {
          this.onAudio.execute(rtp);
        });
      }
    };
    this.pc.connectionStateChange.subscribe((state) => {
      console.log(this.name, "connectionStateChange", state);
    });
    this.pc.addTrack(this.track);
    this.session = new WhipReceiver(this.pc as any);
  }

  handleAudio(rtp: RtpPacket) {
    this.track.writeRtp(rtp);
  }

  handleVideo(rtp: RtpPacket) {}

  async handleOffer(sdp: string) {
    this.createSession();
    const answer = await this.session.setRemoteOffer(sdp);
    return answer;
  }

  async handleIceCandidate(candidate: {
    candidate: string;
    etag: string;
  }): Promise<any> {
    await this.session.iceRequest(candidate);
  }
}
