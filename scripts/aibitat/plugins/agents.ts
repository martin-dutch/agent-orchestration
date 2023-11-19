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
      "List all running agents. An agent is a helpful assistant that can do specific tasks. Returns a list of running agents formatted as JSON",
    parameters: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async handler() {
      const agents = Array.from(aibitat.agents.entries());
      const res = agents.map(([name, agent]) => ({
        name,
        role: agent.role,
        functions: agent.functions,
      }))
      console.debug(res);

      return JSON.stringify(res, null, 2);
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

      const name = new URL(url).hostname;
      const content = await scrape(url);
      console.debug(content);

      aibitat.agent(name, {
        role: `
        You are a specialist on the website of ${url}.`,
        data: content
      });
      aibitat.addToChannel('broadcast', [name]);
      return "Agent " + name + " has joined the chat."
    },
  })
}


function createAgentForExpertise(aibitat: AIbitat<any>): void {
  aibitat.function({
    name: "create-agent-for-expertise",
    description:
      "Create a new agent for a speicific expertise and add it to the channel.",
    parameters: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      required: ["expertise"],
      properties: {
        expertise: {
          type: "string",
          format: "string",
          description: "The expertise niche to create an agent for.",
        },
      },
      additionalProperties: false,
    },
    async handler({expertise}: {expertise: string}) {

      // const name = new URL(url).hostname;
      // const content = await scrape(url);
      // console.debug(content);

      

      aibitat.agent(expertise, {
        role: `
        You are a expertise on ${expertise}.`,
      });
      aibitat.addToChannel('broadcast', [expertise]);
      return "Agent " + expertise + " has joined the chat."
    },
  })
}


export function agents({ dbClient }: AgentsOptions) {
  return {
    name: "agents-plugin",
    setup(aibitat) {
      listRunningAgents(aibitat);
      createAgentForUrl(aibitat);
      createAgentForExpertise(aibitat);
    },
  } as AIbitat.Plugin<any>;
}
