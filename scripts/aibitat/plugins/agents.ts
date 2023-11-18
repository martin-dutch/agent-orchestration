import type { AIbitat } from "..";
import type { PrismaClient } from "@prisma/client";

interface AgentsOptions {
  dbClient: PrismaClient;
}

export function agents({ dbClient }: AgentsOptions) {
  return {
    name: "agents-plugin",
    setup(aibitat) {
      aibitat.function({
        name: "list-running-agents",
        description:
          "List all running agents. An agent is a helpful assistant that can do specific tasks.",
        parameters: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async handler() {
          const agents = Array.from(aibitat.agents.values());
          console.debug(agents);

          return JSON.stringify(agents);
        },
      });
    },
  } as AIbitat.Plugin<any>;
}
