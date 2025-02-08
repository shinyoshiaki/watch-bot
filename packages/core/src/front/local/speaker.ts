import opus from "@discordjs/opus";
import Speaker from "speaker";
import { PromiseQueue } from "werift";

export const createOpusSpeaker = () => {
  const queue = new PromiseQueue();
  const decoder = new opus.OpusEncoder(48000, 2);
  const speaker = new Speaker({
    channels: 2,
    bitDepth: 16,
    sampleRate: 48000,
  });

  return {
    write: (opus: Buffer) => {
      queue.push(async () => {
        const pcm = decoder.decode(opus);
        speaker.write(pcm);
        await new Promise((r) => setTimeout(r, 20));
      });
    },
    close: () => {
      speaker.close(false);
    },
  };
};
