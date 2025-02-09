import {
  type AccessoryDevice,
  AlexaFrontDevice,
  type FrontDeviceName,
  Session,
  type SessionSensor,
  type VertexConfig,
  WHIPFrontDevice,
  setupGoogleNest,
  setupRing,
} from "../import/core.js";

interface SessionOptions {
  vertex?: VertexConfig;
  model?: string;
}

export const createSession = ({
  id,
  frontDevice,
  llmApiKey,
  sensors,
  options,
}: {
  id: string;
  sensors: SessionSensor;
  frontDevice?: FrontDeviceName;
  llmApiKey: string;
  options?: SessionOptions;
}) => {
  const { nest, ring } = sensors;

  const session = new Session({
    id,
    llmApiKey,
    options,
  });
  if (frontDevice) {
    session.setFrontDevice(frontDevice);
  }

  (async () => {
    const accessories: AccessoryDevice[] = (
      await Promise.allSettled([
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
      ])
    )
      .filter((x) => {
        if (x.status === "rejected") {
          console.error(x.reason);
        }
        return x.status === "fulfilled";
      })
      .map((x) => x.value)
      .filter((x): x is NonNullable<typeof x> => x != undefined)
      .flat();

    for (const device of accessories) {
      session.sensors.push(device);
    }
    await session.init();
  })();

  return session;
};
