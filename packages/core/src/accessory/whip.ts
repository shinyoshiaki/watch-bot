import { randomUUID } from "crypto";
import { serve } from "@hono/node-server";
import { WhipReceiver } from "@werift/whip-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { RTCPeerConnection, type RtpPacket } from "werift";
import { AccessoryDevice } from "./base.js";

export interface WHIPAccessoryConfig {
  port?: number;
  id?: string;
}

export class WHIPAccessory extends AccessoryDevice {
  readonly name: string;
  readonly videoCodec = "vp8";
  private pc = new RTCPeerConnection();
  private session: WhipReceiver;
  readonly id: string;

  constructor({ port, id }: WHIPAccessoryConfig) {
    super();

    this.name = "WHIP_" + port;
    this.id = id ?? randomUUID();

    this.pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        e.track.onReceiveRtp.subscribe((rtp) => {
          this.onAudio.execute(rtp);
        });
      }
      if (e.track.kind === "video") {
        e.track.onReceiveRtp.subscribe((rtp) => {
          this.onVideo.execute(rtp);
        });
        e.track.onReceiveRtp.once(() => {
          setInterval(
            () => e.transceiver.receiver.sendRtcpPLI(e.track.ssrc!),
            1000,
          );
        });
      }
    };
    this.pc.connectionStateChange.subscribe((state) => {
      console.log(this.name, "connectionStateChange", state);
    });

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

    this.session = new WhipReceiver(this.pc);
  }

  sendAudio(rtp: RtpPacket): void {}

  sendVideo(rtp: RtpPacket): void {}

  async handleOffer(sdp: string) {
    return await this.session.setRemoteOffer(sdp);
  }

  async handleIceCandidate(candidate: {
    candidate: string;
    etag: string;
  }): Promise<any> {
    await this.session.iceRequest(candidate);
  }
}
