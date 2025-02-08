import { randomUUID } from "crypto";

import type { AccessoryDevice } from "./accessory/base.js";
import {
  type GoogleNestCredentials,
  setupGoogleNest,
} from "./accessory/nest.js";
import { type RingCredentials, setupRing } from "./accessory/ring/ring.js";
import { WHIPAccessory, type WHIPAccessoryConfig } from "./accessory/whip.js";
import { AlexaFrontDevice } from "./front/alexa.js";
import type { FrontDevice } from "./front/base.js";
import { WHIPFrontDevice } from "./front/whip.js";
import type { VertexConfig } from "./imports/gemini.js";
import type { LLMAgent } from "./llm/base.js";
import { GeminiLLM } from "./llm/gemini.js";
import { MultiModalLLM } from "./llm/multimodal/gemini.js";
import { frontLLMPrompt } from "./prompt.js";

interface SessionOptions {
  vertex?: VertexConfig;
  model?: string;
}

export class Session {
  readonly id: string;
  readonly frontDevice: FrontDevice;
  frontLLM!: LLMAgent;
  tasks: MultiModalLLM[] = [];
  accessories: AccessoryDevice[] = [];

  constructor(
    readonly props: {
      id?: string;
      llmApiKey: string;
      frontDevice: FrontDevice;
      accessories?: AccessoryDevice[];
      options?: SessionOptions;
    },
  ) {
    this.id = props.id ?? randomUUID();
    this.frontDevice = props.frontDevice;
    this.accessories = props.accessories ?? [];
  }

  async init() {
    const deviceNames = this.accessories.map((d) => d.name);

    this.frontLLM = new GeminiLLM({
      apiKey: this.props.llmApiKey,
      systemInstruction: frontLLMPrompt.systemInstruction(deviceNames),
      declarations: frontLLMPrompt.declarations,
      responseModality: "audio",
      model: this.props.options?.model,
      vertex: this.props.options?.vertex,
    });

    this.frontLLM.onToolCall.subscribe(async (call) => {
      console.log("front Tool call", JSON.stringify(call, null, 2));

      switch (call.name) {
        case "device_list":
          {
            this.deviceList({ id: call.id, deviceNames });
          }
          break;
        case "set_task":
          {
            const { device: deviceName, task } = call.args as {
              device: string;
              task: string;
            };
            const res = await this.setTask({ deviceName, task }).catch((e) => ({
              e,
            }));
            if ("e" in res) {
              this.frontLLM.sendToolCallResponse({
                id: call.id,
                response: { ok: false },
              });
              return;
            }
            this.frontLLM.sendToolCallResponse({
              id: call.id,
              response: {
                id: res.id,
              },
            });
          }
          break;
        case "task_list":
          {
            const list = this.taskList();
            this.frontLLM.sendToolCallResponse({
              id: call.id,
              response: { list },
            });
          }
          break;
        case "abort_task":
          {
            const { id } = call.args as { id: string };
            const res = await this.abortTask({ id })
              .then(() => ({ ok: true }))
              .catch((e) => ({ e }));
            if ("e" in res) {
              this.frontLLM.sendToolCallResponse({
                id: call.id,
                response: { ok: false },
              });
              return;
            }
            this.frontLLM.sendToolCallResponse({
              id: call.id,
              response: { ok: true },
            });
          }
          break;
      }
    });
    this.frontLLM.onAudio.subscribe((rtp) => {
      this.frontDevice.handleAudio(rtp);
    });
    this.frontLLM.onCompleteText.subscribe((text) => {
      console.log("front complete text", text);
      this.frontLLM.muteInputAudio = false;
      this.frontLLM.unmuteAt = Date.now();
    });
    this.frontDevice.onAudio.subscribe((rtp) => {
      this.frontLLM.sendAudio(rtp);
    });

    await this.frontLLM.start();
  }

  private async createMultiModalLLM(device: AccessoryDevice, task: string) {
    const multiModalLLM = new MultiModalLLM({
      device,
      apiKey: this.props.llmApiKey,
      model: this.props.options?.model,
      vertex: this.props.options?.vertex,
      task,
    });
    multiModalLLM.onCompleteTask.subscribe(({ task, result }) => {
      const complete = frontLLMPrompt.completeTask({
        task,
        result,
      });
      this.frontLLM.sendCompleteText(complete);
    });
    this.tasks.push(multiModalLLM);
    multiModalLLM.onCompleteTask.once(() => {
      this.tasks = this.tasks.filter((t) => t.id !== multiModalLLM.id);
    });
    await multiModalLLM.start();
    return multiModalLLM;
  }

  private deviceList({
    id,
    deviceNames,
  }: { id: string; deviceNames: string[] }) {
    this.frontLLM.sendToolCallResponse({
      id,
      response: {
        devices: deviceNames,
      },
    });
  }

  private async setTask({
    deviceName,
    task,
  }: { deviceName: string; task: string }) {
    const device = this.accessories.find((d) => d.name === deviceName);
    if (!device) {
      throw new Error("device not found");
    }
    return await this.createMultiModalLLM(device, task);
  }

  private taskList() {
    return this.tasks.map((t) => t.task);
  }

  private async abortTask({ id }: { id: string }) {
    const task = this.tasks.find((t) => t.id === id || t.task === id);
    if (!task) {
      throw new Error("task not found");
    }
    this.tasks = this.tasks.filter((t) => t.id !== id);
    task.close();
  }
}

export type FrontDeviceName =
  | typeof WHIPFrontDevice.deviceName
  | typeof AlexaFrontDevice.deviceName;

export type SessionAccessory = {
  nest?: GoogleNestCredentials;
  ring?: RingCredentials;
  whip?: WHIPAccessoryConfig[];
};

export const createSession = ({
  id,
  frontDevice,
  llmApiKey,
  accessories,
  options,
}: {
  id?: string;
  accessories: SessionAccessory;
  frontDevice: {
    name: FrontDeviceName;
    port?: number;
  };
  llmApiKey: string;
  options?: SessionOptions;
}) => {
  const { nest, ring, whip } = accessories;

  const frontDeviceInstance = (() => {
    switch (frontDevice.name) {
      case WHIPFrontDevice.deviceName:
        return new WHIPFrontDevice({ port: frontDevice.port });
      case AlexaFrontDevice.deviceName:
        return new AlexaFrontDevice({ port: frontDevice.port });
    }
  })();

  const session = new Session({
    id,
    frontDevice: frontDeviceInstance,
    llmApiKey,
    options,
  });

  (async () => {
    const accessories: AccessoryDevice[] = (
      await Promise.all([
        (async () => {
          if (nest) {
            const devices = await setupGoogleNest({
              ...nest,
            });
            return devices;
          }
        })(),
        (async () => {
          if (ring) {
            const devices = await setupRing({
              ...ring,
            });
            return devices;
          }
        })(),
        (async () => {
          if (whip) {
            const devices = whip.map((c) => new WHIPAccessory(c));
            return devices;
          }
        })(),
      ])
    )
      .flat()
      .filter((x): x is NonNullable<typeof x> => x != undefined);
    session.accessories = accessories;
    await session.init();
  })();

  return session;
};
