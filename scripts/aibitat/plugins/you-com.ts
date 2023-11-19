import type { AIbitat } from "..";
import type { PrismaClient } from "@prisma/client";
import { FunctionConfig } from "../function";
import dotenv from "dotenv";

dotenv.config({ path: `.env` });

function search(aibitat: AIbitat<any>): void {
  aibitat.function({
    name: "search-for-websites",
    description:
      "Searches for relevant websites to turn into agents. And returns their URLs",
    parameters: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The query to find the websites for.",
        },
        size: {
          type: "number",
          description: "Maximum number of websites to search",
          default: 5,
        }
      },
      additionalProperties: false,
    },
    async handler({ query, size = 5 }: { query: string, size: number }) {
      const url = new URL("https://api.ydc-index.io/search");
      url.searchParams.set("query", query);
      url.searchParams.set("num_web_results", size.toString());

      const res = await fetch(url, {
        headers: {
          "X-API-Key": process.env.YOU_API_KEY!,
        },
      });

      const json = await res.json();

      const urls = json.hits.map((h: any) => h.url);
      console.log(urls);

      return JSON.stringify(urls);
    },
  });
}

function research(aibitat: AIbitat<any>): void {
  aibitat.function({
    name: "search-for-facts",
    description:
      "Searches for relevant info online to fact check statements",
    parameters: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The query to find the information for.",
        }
      },
      additionalProperties: false,
    },
    async handler({ query }: { query: string, size: number }) {
      const url = new URL("https://api.ydc-index.io/search");
      url.searchParams.set("query", query);
      url.searchParams.set("num_web_results", "5");

      const res = await fetch(url, {
        headers: {
          "X-API-Key": process.env.YOU_API_KEY!,
        },
      });

      const json = await res.json();

      const urls = json.hits.map((h: {snippets: string[]}) => h.snippets.join(' '));
      console.log('snippet',urls);

      return JSON.stringify(urls);
    },
  });
}

export function youCom({}: {}) {
  return {
    name: "you.com-plugin",
    setup(aibitat) {
      search(aibitat);
      research(aibitat)
    },
  } as AIbitat.Plugin<any>;
}