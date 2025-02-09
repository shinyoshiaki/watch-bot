const { ENDPOINT, RING, NEST } = process.env;

import { JsonRpcClient, websocketAdapter } from "../../json-rpc/src/index.js";
import type { FunctionFrontCall } from "../../service/src/schema.js";

export const handler = async (request, context) => {
  log("DEBUG:", "Request", request.directive.header.name);

  if (
    request.directive.header.namespace === "Alexa.Discovery" &&
    request.directive.header.name === "Discover"
  ) {
    log("DEBUG:", "Discover request", JSON.stringify(request));
    handleDiscovery(request, context);
  } else if (
    request.directive.header.namespace === "Alexa.RTCSessionController"
  ) {
    if (
      (request as InitiateSessionWithOffer).directive.header.name ===
      "InitiateSessionWithOffer"
    ) {
      log(
        "DEBUG:",
        "InitiateSessionWithOffer request",
        JSON.stringify(request),
      );
      await handleInitiateSessionWithOffer(request, context);
    }
    if (
      (request as SessionConnected).directive.header.name === "SessionConnected"
    ) {
      log("DEBUG:", "SessionConnected request", JSON.stringify(request));
      handleSessionConnected(request, context);
    }
  } else if (
    request.directive.header.namespace === "Alexa.Authorization" &&
    request.directive.header.name === "AcceptGrant"
  ) {
    log("DEBUG:", "AcceptGrant request", JSON.stringify(request));
    handleAuthorization(request, context);
  } else {
    log("DEBUG:", "Unknown request", JSON.stringify(request));
  }

  function handleAuthorization(request, context) {
    // AcceptGrant応答を送信します
    var payload = {};
    var header = request.directive.header;
    header.name = "AcceptGrant.Response";
    log(
      "DEBUG",
      "AcceptGrant Response: ",
      JSON.stringify({ header: header, payload: payload }),
    );
    context.succeed({ event: { header: header, payload: payload } });
  }

  function handleDiscovery(request, context) {
    // 検出応答を送信します
    var payload = {
      endpoints: [
        {
          endpointId: "sample-chatgpt02",
          manufacturerName: "エージェント",
          friendlyName: "エージェント",
          description: "ChatGPT",
          displayCategories: ["DOORBELL"],
          capabilities: [
            {
              type: "AlexaInterface",
              interface: "Alexa.RTCSessionController",
              version: "3",
              configuration: {
                isFullDuplexAudioSupported: true,
              },
            },
          ],
        },
      ],
    };
    var header = request.directive.header;
    header.name = "Discover.Response";
    log(
      "DEBUG",
      "Discovery Response: ",
      JSON.stringify({ header: header, payload: payload }),
    );
    context.succeed({ event: { header, payload } });
  }

  async function handleInitiateSessionWithOffer(
    request: InitiateSessionWithOffer,
    context,
  ) {
    const url = "https://api.amazon.com/user/profile";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${request.directive.endpoint.scope.token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const msg = `Failed to get user profile: ${response.statusText}`;
      log("ERROR", "getUserProfile", msg);
      throw new Error(msg);
    }

    const data: { user_id: string; name: string; email: string } =
      await response.json();
    log("DEBUG", "TokenInfo: ", JSON.stringify(data));

    const offer = request.directive.payload.offer;

    const ws = new WebSocket(ENDPOINT!);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    const rpcClient = new JsonRpcClient(...websocketAdapter(ws));
    const frontCall: FunctionFrontCall = {
      sensors: {
        nest: NEST ? JSON.parse(NEST) : undefined,
        ring: RING ? JSON.parse(RING) : undefined,
      },
      userId: data.user_id,
      offer: offer.value,
      frontDevice: "alexa",
      email: data.email,
      name: data.name,
    };
    const { answer } = await rpcClient.call("front_call", frontCall);

    log("DEBUG", "SDP Response: ", answer);

    const event: AnswerGeneratedForSession = {
      event: {
        header: {
          ...request.directive.header,
          name: "AnswerGeneratedForSession",
        },
        endpoint: request.directive.endpoint,
        payload: {
          answer: {
            format: "SDP",
            value: answer,
          },
        },
      },
    };
    context.succeed(event);
  }

  function handleSessionConnected(request: SessionConnected, context) {
    const event: SessionConnectedEvent = {
      event: {
        header: {
          ...request.directive.header,
          name: "SessionConnected",
        },
        endpoint: request.directive.endpoint,
        payload: {
          sessionId: request.directive.payload.sessionId,
        },
      },
    };
    context.succeed(event);
  }
};

function log(message, message1, message2) {
  console.log(message + message1 + message2);
}

interface InitiateSessionWithOffer {
  directive: {
    header: {
      namespace: string;
      name: string;
      messageId: string; // 一意のバージョン4 UUID
      correlationToken: string; // opaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
      cookie: Record<string, unknown>;
    };
    payload: {
      sessionId: string; // セッション識別子
      offer: {
        format: string; // "SDP"
        value: string; // SDPオファー値
      };
    };
  };
}

interface AnswerGeneratedForSession {
  event: {
    header: {
      namespace: string; // "Alexa.RTCSessionController"
      name: string; // "AnswerGeneratedForSession"
      messageId: string; // 一意の識別子、バージョン4 UUIDが望ましい
      correlationToken: string; // リクエストに一致するopaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
    };
    payload: {
      answer: {
        format: string; // "SDP"
        value: string; // SDPアンサー値
      };
    };
  };
}

interface SessionConnected {
  directive: {
    header: {
      namespace: string; // "Alexa.RTCSessionController"
      name: string; // "SessionConnected"
      messageId: string; // 一意のバージョン4 UUID
      correlationToken: string; // opaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
      cookie: Record<string, unknown>;
    };
    payload: {
      sessionId: string; // セッション識別子
    };
  };
}

interface SessionConnectedEvent {
  event: {
    header: {
      namespace: string; // "Alexa.RTCSessionController"
      name: string; // "SessionConnected"
      messageId: string; // 一意の識別子、バージョン4 UUIDが望ましい
      correlationToken: string; // リクエストに一致するopaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
    };
    payload: {
      sessionId: string; // セッション識別子
    };
  };
}
