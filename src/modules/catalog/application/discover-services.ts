import { matchServices, type MatchRequest, type ServiceMatch } from "../domain/match-service";
import type { ServiceOffering } from "../domain/service";

export interface ActiveCatalog {
  listActive(workspaceId: string): Promise<ServiceOffering[]>;
}

export async function discoverServices(
  catalog: ActiveCatalog,
  workspaceId: string,
  request: MatchRequest
): Promise<ServiceMatch[]> {
  return matchServices(await catalog.listActive(workspaceId), request);
}
