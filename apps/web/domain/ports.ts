/**
 * RFC-0003: Frontend port composition for the mock-first ordering demo.
 *
 * 页面只依赖这个 adapter locator；后续接入真实后端时替换 createMockFrontendPorts 的实现即可。
 */
import { createMockFrontendPorts } from "@/adapters/mock-ports";
import type { FrontendPorts } from "@/ports/frontend-ports";

let ports: FrontendPorts | null = null;

export const runtimeMode = "mock" as const;

export function getFrontendPorts(): FrontendPorts {
  if (!ports) {
    ports = createMockFrontendPorts();
  }
  return ports;
}
