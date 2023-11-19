import type { AIbitat } from "..";
import type { PrismaClient } from "@prisma/client";
import { FunctionConfig } from "../function";
import { scrape } from "./web-browsing";

interface AgentsOptions {
  dbClient: PrismaClient;
}

function listRunningAgents(aibitat: AIbitat<any>): void {
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
  })
}

function createAgentForUrl(aibitat: AIbitat<any>): void {
  aibitat.function({
    name: "create-agent-for-url",
    description:
      "Create a new agent for information from a given URL and add it to the channel.",
    parameters: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "The URL to create an agent for.",
        },
      },
      additionalProperties: false,
    },
    async handler({url}: {url: string}) {

      const name ='agent-' + new URL(url).hostname;
      const content = await scrape(url);
      console.debug(content);

      aibitat.agent(name, {
        role: 'You are a human assistant. Here is your specialist data:' + content + '.',
      });
      aibitat.addToChannel('broadcast', [name]);
      return "Agent " + name + " has joined the chat."
    },
  })
}


export function agents({ dbClient }: AgentsOptions) {
  return {
    name: "agents-plugin",
    setup(aibitat) {
      listRunningAgents(aibitat);
      createAgentForUrl(aibitat);
    },
  } as AIbitat.Plugin<any>;
}
