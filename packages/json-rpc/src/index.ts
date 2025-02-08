// json-rpc.ts

// ========================
// JSON-RPC の型定義
// ========================

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  // 通常はリクエストの場合 id が存在しますが、notification の場合は省略可能です
  id?: string | number | null;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  result: any;
  id: string | number | null;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  error: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

// ========================
// JSON-RPC サーバ実装
// ========================

export type JsonRpcMethodHandler = (params: any) => Promise<any> | any;

export class JsonRpcServer {
  private methods: Map<string, JsonRpcMethodHandler> = new Map();

  /**
   * メソッドハンドラを登録します。
   * @param method - JSON-RPC のメソッド名
   * @param handler - 対応するハンドラ関数
   */
  public registerMethod(method: string, handler: JsonRpcMethodHandler): void {
    if (this.methods.has(method)) {
      throw new Error(`Method ${method} is already registered`);
    }
    this.methods.set(method, handler);
  }

  /**
   * JSON-RPC リクエスト（またはバッチリクエスト）を処理し、レスポンスを返します。
   * 通知（id が undefined または null）の場合はレスポンスは返しません。
   * @param request - JSON-RPC リクエストオブジェクトまたはその配列
   */
  public async handleRequest(
    request: JsonRpcRequest | JsonRpcRequest[],
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | undefined> {
    if (Array.isArray(request)) {
      // バッチリクエストの場合
      if (request.length === 0) {
        // JSON-RPC 2.0 仕様では空の配列は無効です
        return this.makeErrorResponse(
          null,
          -32600,
          "Invalid Request: empty batch",
        );
      }
      const promises = request.map((req) => this.handleSingleRequest(req));
      const responses = await Promise.all(promises);
      // notification の場合はレスポンスが undefined になるので、フィルタリング
      const filtered = responses.filter((r) => r !== undefined);
      return filtered.length > 0 ? filtered : undefined;
    } else {
      return this.handleSingleRequest(request);
    }
  }

  private async handleSingleRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse | undefined> {
    if (!this.isValidRequest(request)) {
      return this.makeErrorResponse(
        request.id ?? null,
        -32600,
        "Invalid Request",
        request,
      );
    }
    const { method, params, id } = request;
    const handler = this.methods.get(method);
    if (!handler) {
      return this.makeErrorResponse(id ?? null, -32601, "Method not found");
    }
    try {
      const result = await Promise.resolve(handler(params));
      // 通知の場合は id が undefined もしくは null のため、レスポンス不要
      if (id === undefined || id === null) {
        return undefined;
      }
      return {
        jsonrpc: "2.0",
        result: result,
        id: id,
      };
    } catch (err: any) {
      return this.makeErrorResponse(
        id ?? null,
        -32000,
        err.message || "Server error",
        err.data,
      );
    }
  }

  private isValidRequest(request: any): JsonRpcRequest {
    return (
      request &&
      request.jsonrpc === "2.0" &&
      typeof request.method === "string" &&
      ("id" in request
        ? typeof request.id === "string" ||
          typeof request.id === "number" ||
          request.id === null
        : true)
    );
  }

  private makeErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: any,
  ): JsonRpcError {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        data,
      },
      id: id,
    };
  }
}

// ========================
// JSON-RPC クライアント実装
// ========================

/**
 * メッセージ送信用の関数の型定義。
 * 送信部分は任意のプロトコルに合わせて実装してください。
 */
export type TransportSendFunction = (message: string) => void;

/**
 * メッセージ受信時のコールバックを登録する関数の型定義。
 */
export type TransportOnMessageFunction = (
  callback: (message: string) => void,
) => void;

export class JsonRpcClient {
  private idCounter = 1;
  // 保留中のリクエストを管理するマップ。リクエスト id と、そのレスポンスを処理する関数を関連付けます。
  private pendingRequests: Map<
    string | number,
    (response: JsonRpcResponse) => void
  > = new Map();

  /**
   * コンストラクタ
   * @param send - JSON-RPC メッセージを送信する関数（文字列で送信）
   * @param onMessage - 受信したメッセージを受け取るコールバック登録関数
   */
  constructor(
    private send: TransportSendFunction,
    onMessage: TransportOnMessageFunction,
  ) {
    // 受信時のコールバックを登録
    onMessage(this.onMessage.bind(this));
  }

  private onMessage(message: string): void {
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (err) {
      // 無効な JSON 文字列が送られてきた場合は無視
      return;
    }
    if (Array.isArray(data)) {
      // バッチレスポンスの場合
      for (const resp of data) {
        this.handleResponse(resp);
      }
    } else {
      this.handleResponse(data);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const id = response.id;
    if (id === undefined || id === null) return;
    const resolver = this.pendingRequests.get(id);
    if (resolver) {
      resolver(response);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * JSON-RPC のメソッド呼び出しを行います。
   * レスポンスが返ってくると Promise が解決され、結果またはエラーが返ります。
   * @param method - 呼び出すメソッド名
   * @param params - メソッドパラメータ
   */
  public call(method: string, params?: any): Promise<any> {
    const id = this.idCounter++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (response: JsonRpcResponse) => {
        if ("result" in response) {
          resolve(response.result);
        } else {
          reject(response.error);
        }
      });
      this.send(JSON.stringify(request));
    });
  }

  /**
   * 通知（レスポンスを期待しない呼び出し）を行います。
   * @param method - 通知するメソッド名
   * @param params - パラメータ
   */
  public notify(method: string, params?: any): void {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.send(JSON.stringify(request));
  }
}

export const tryWith = <T>(cb: () => T) => {
  try {
    return cb();
  } catch (error) {
    return { error };
  }
};

export const parseErrorResponse = {
  jsonrpc: "2.0",
  error: { code: -32700, message: "Parse error" },
  id: null,
};
