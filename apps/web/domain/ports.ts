/**
 * RFC-0003: Frontend port composition.
 *
 * 默认使用 HTTP Adapter 连接 RFC-0002 API/Postgres，并在服务不可用时降级到 Mock。
 * 显式设置 NEXT_PUBLIC_RUNTIME_MODE=mock 可运行纯前端演示。
 */
import { createHttpFrontendPorts } from "@/adapters/http-ports";
import { createMockFrontendPorts } from "@/adapters/mock-ports";
import type { FrontendPorts } from "@/ports/frontend-ports";

let ports: FrontendPorts | null = null;

export const runtimeMode = process.env.NEXT_PUBLIC_RUNTIME_MODE === "mock"
  ? "mock"
  : "http-with-mock-fallback";

export function getFrontendPorts(): FrontendPorts {
  if (!ports) {
    ports = runtimeMode === "mock"
      ? createMockFrontendPorts()
      : createHttpFrontendPorts();
  }
  return ports;
}
