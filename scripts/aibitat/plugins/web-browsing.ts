import { loadSummarizationChain } from 'langchain/chains'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { PromptTemplate } from 'langchain/prompts'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { NodeHtmlMarkdown } from 'node-html-markdown'

import type { AIbitat } from '..'

/**
 * Use serper.dev to search on Google.
 *
 * **Requires an SERPER_API_KEY environment variable**.
 *
 * @param query
 * @param options
 * @returns
 */
async function search(
  query: string,
  options: {
    /**
     * `serper.dev` API key.
     * @default process.env.SERPER_API_KEY
     */
    serperApiKey?: string
  } = {},
) {
  console.log('🔥 ~ Searching on Google...')
  const url = 'https://google.serper.dev/search'

  const payload = JSON.stringify({
    q: query,
  })

  const headers = {
    'X-API-KEY': options.serperApiKey || (process.env.SERPER_API_KEY as string),
    'Content-Type': 'application/json',
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: payload,
  })

  return response.text()
}

/**
 * Scrape a website and summarize the content based on objective if the content is too large.
 * Objective is the original objective & task that user give to the agent, url is the url of the website to be scraped.
 * `BROWSERLESS_TOKEN` environment variable is required.
 *
 * @param url
 * @returns
 */
export async function scrape(url: string) {
  console.log('🔥 Scraping website...', url)

  const headers = {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json',
  }

  const data = {
    url: url,
  }

  const data_json = JSON.stringify(data)
  console.log(`https://chrome.browserless.io/content?token=${process.env.BROWSERLESS_TOKEN}`)
  const response = await fetch(
    `https://chrome.browserless.io/content?token=${process.env.BROWSERLESS_TOKEN}`,
    {
      method: 'POST',
      headers: headers,
      body: data_json,
    },
  )

  if (response.status !== 200) {
    console.log('🔥 ~ error', data)
    console.log('🔥 ~ error', response)
    return `HTTP request failed with status code "${response.status}: ${response.statusText}"`
  }

  const html = await response.text()
  const text = NodeHtmlMarkdown.translate(html)

  console.log('🔥 ~ text', text)
  if (text.length <= 8000) {
    return text
  }

  console.log('🔥 Text is too long. Summarizing...', text)
  return summarize(text)
}

/**
 * Summarize content using OpenAI's GPT-3.5 model.
 *
 * @param content The content to summarize.
 * @returns The summarized content.
 */
export async function summarize(content: string): Promise<string> {
  const llm = new ChatOpenAI({
    temperature: 0,
    modelName: 'gpt-3.5-turbo-16k-0613',
  })

  const textSplitter = new RecursiveCharacterTextSplitter({
    separators: ['\n\n', '\n'],
    chunkSize: 10000,
    chunkOverlap: 500,
  })
  const docs = await textSplitter.createDocuments([content])

  const mapPrompt = `
    Write a detailed summary of the following text for a research purpose:
    "{text}"
    SUMMARY:
    `

  const mapPromptTemplate = new PromptTemplate({
    template: mapPrompt,
    inputVariables: ['text'],
  })

  // This convenience function creates a document chain prompted to summarize a set of documents.
  const chain = loadSummarizationChain(llm, {
    type: 'map_reduce',
    combinePrompt: mapPromptTemplate,
    combineMapPrompt: mapPromptTemplate,
    verbose: true,
  })
  const res = await chain.call({
    input_documents: docs,
  })

  return res.text
}

export function experimental_webBrowsing({ }: {} = {}) {
  return {
    name: 'web-browsing-plugin',
    setup(aibitat) {
      //'Scrape a website and summarize the content based on objective if the content is too large.',

      aibitat.function({
        name: 'web-browsing',
        description:
          'Searches for a given query online or navigate to a given url.',
        parameters: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'A search query.',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'A web URL.',
            },
          },
          oneOf: [{ required: ['query'] }, { required: ['url'] }],
          additionalProperties: false,
        },
        async handler({ query, url }) {
          console.log('🔥 ~ Browsing on the internet')
          console.log('qyery', query)
          console.log('url', url)
          if (url) {
            return await scrape(url)
          }

          return await search(query)
        },
      })
    },
  } as AIbitat.Plugin<any>
}

export function agent_creation({ }: {} = {}) {
  return {
    name: 'agent-creation-plugin',
    setup(aibitat) {
      aibitat.function({
        name: 'create-agent',
        description:
          'Creates a agent based on the url provided.',
        parameters: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'A web URL.',
            },
          },
          required: ['url'],
          additionalProperties: false,
        },
        async handler({ url }) {
          console.log('🔥 ~ Creating the agent based on the content from the url.')
          const name ='agent-' + new URL(url).hostname;
          const content = await scrape(url);
          // name is the root domain of the url with agent- prefix
          aibitat.agent(name, {
            role: 'You are a human assistant. Here is your specialist data:' + content + '.',
          });
          aibitat.addToChannel('management', [name]);
          return "Agent " + name + " has joined the chat."
        },
      })
    },
  } as AIbitat.Plugin<any>
}
