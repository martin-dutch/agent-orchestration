import dotenv from "dotenv";
import { StreamingTextResponse, LangChainStream } from "ai";
import { auth, currentUser } from "@clerk/nextjs";
import { Replicate } from "langchain/llms/replicate";
import { CallbackManager } from "langchain/callbacks";
import { NextResponse } from "next/server";
import OpenAI from 'openai'

import { MemoryManager } from "@/lib/memory";
import prismadb from "@/lib/prismadb";
import { Assistant } from "openai/resources/beta/assistants/assistants.mjs";

dotenv.config({ path: `.env` });

// Your tool (a fancy name for a function)
async function addNumbers(a: number, b: number): Promise<number> {
  // An actual tool will likely do some asynchronous stuff, like calling an API
  await new Promise((resolve) => setTimeout(resolve, 100));
  return a + b;
}

// Hardcoded assistant details
const ASSISTANT_NAME = "My Assistant with a custom tool to add two numbers";
const ASSISTANT_MODEL = "gpt-4-1106-preview";
const ASSISTANT_DESCRIPTION =
  "A friendly assistant to help you with your queries.";


export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json();
    console.log('prompt', prompt)
    const user = await currentUser();
    console.log('user', user)
    const chatId = params.chatId;
    console.log('chatId', chatId)

    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = request.url + "-" + user.id;
    // const { success } = await rateLimit(identifier);

    // if (!success) {
    //   return new NextResponse("Rate limit exceeded", { status: 429 });
    // }

    const companion = await prismadb.companion.update({
      where: {
        id: params.chatId
      },
      data: {
        messages: {
          create: {
            content: prompt,
            role: "user",
            userId: user.id,
          },
        },
      }
    });

    const threadId = companion.threadId;

    if (!companion || !threadId) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    const name = companion.id;
    const companion_file_name = name + ".txt";

    const companionKey = {
      companionName: name!,
      userId: user.id,
      modelName: "llama2-13b",
    };
    const memoryManager = await MemoryManager.getInstance();

    const records = await memoryManager.readLatestHistory(companionKey);
    if (records.length === 0) {
      await memoryManager.seedChatHistory(companion.seed, "\n\n", companionKey);
    }
    await memoryManager.writeToHistory("User: " + prompt + "\n", companionKey);

    // Query Pinecone

    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);

    // Right now the preamble is included in the similarity search, but that
    // shouldn't be an issue

    console.log('pinecone search starting', recentChatHistory)
    console.log('companion_file_name',companion_file_name)
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion_file_name
    );
    console.log('pinecone search ending', similarDocs)

    let relevantHistory = "";
    if (!!similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
    }
    const { handlers } = LangChainStream();
    // Call Replicate for inference
    // const model = new Replicate({
    //   model:
    //     "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
    //   input: {
    //     max_length: 2048,
    //   },
    //   apiKey: process.env.REPLICATE_API_TOKEN,
    //   callbackManager: CallbackManager.fromHandlers(handlers),
    // });

    // // Turn verbose on for debugging
    // model.verbose = true;

    // const resp = String(
    //   await model
    //     .call(
    //       `
    //     ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.name}: prefix. 

    //     ${companion.instructions}

    //     Below are relevant details about ${companion.name}'s past and the conversation you are in.
    //     ${relevantHistory}


    //     ${recentChatHistory}\n${companion.name}:`
    //     )
    //     .catch(console.error)
    // );

    

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    let assistant: Assistant | undefined = undefined
    if (!assistant) {
      assistant = await openai.beta.assistants.create({
        name: ASSISTANT_NAME,
        model: ASSISTANT_MODEL,
        instructions: ASSISTANT_DESCRIPTION,
        // Adding an example tool
        tools: [
          {
            type: "function",
            function: {
              name: "addNumbers",
              description: "Add two numbers",
              parameters: {
                type: "object",
                properties: {
                  a: { type: "number", description: "First number" },
                  b: { type: "number", description: "Second number" },
                },
                required: ["a", "b"],
              },
            },
          },
        ],
      });
    }
    // Create a message in the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content:  `
          ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.name}: prefix. 
  
          ${companion.instructions}
  
          Below are relevant details about ${companion.name}'s past and the conversation you are in.
          ${relevantHistory}
  
  
          ${recentChatHistory}\n${companion.name}:`,
    });

    // Run the assistant on the thread to get a response
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistant.id,
    });

    // Poll for the completion of the run
    let completedRun;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay for 1 second
      completedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);

      console.log("Run status: " + completedRun.status)
      // KEY Check if status requires action then run our custom function
      if (
        completedRun.status === "requires_action" &&
        completedRun.required_action
      ) {
        const toolCalls =
          completedRun.required_action.submit_tool_outputs.tool_calls;
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === "addNumbers") {
            // KEY Actually call the tool
            console.log("Actually call the tool" + toolCall.function.name)

            // TODO: Add zod validation later
            const args = JSON.parse(toolCall.function.arguments);
            console.log('args', args)
            const result = await addNumbers(args.a, args.b);
            console.log('result', result)
            // KEY Submit the output back to the run
            await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
              tool_outputs: [
                {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({ result }),
                },
              ],
            });
          }
        }

        // Continue polling for completion
        continue;
      }

      // Return if the run appears dead
      if (
        completedRun.status === "cancelled" ||
        completedRun.status === "cancelling" ||
        completedRun.status === "failed" ||
        completedRun.status === "expired"
      ) {
        return new Response(
          `Run stopped due to status: ${completedRun.status}`,
          {
            headers: { "Content-Type": "text/plain" },
          }
        );
      }
    } while (completedRun.status !== "completed");

    // Retrieve the messages added by the Assistant to the Thread after the Run completes
    const messages = await openai.beta.threads.messages.list(threadId);

    // A bunch of boring safety checks
    const lastMessage = messages.data.at(0);
    if (lastMessage?.role !== "assistant") {
      return new Response("Last message not from the assistant", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    const assistantMessageContent = lastMessage.content.at(0);
    if (!assistantMessageContent) {
      return new Response("No assistant message found", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (assistantMessageContent.type !== "text") {
      return new Response(
        "Assistant message is not text, only text supported in this demo",
        {
          headers: { "Content-Type": "text/plain" },
        }
      );
    }
    
    // .assistants.create({
    //     instructions: "You are a personal math tutor. When asked a math question, write and run code to answer the question.",
    //     model: "gpt-4-1106-preview",
    //     tools: [{"type": "code_interpreter"}]
    //   });


    const cleaned = assistantMessageContent.text.value.replaceAll(",", "");
    const chunks = cleaned.split("\n");
    const response = chunks[0];

    await memoryManager.writeToHistory("" + response.trim(), companionKey);
    var Readable = require("stream").Readable;

    let s = new Readable();
    s.push(response);
    s.push(null);
    if (response !== undefined && response.length > 1) {
      memoryManager.writeToHistory("" + response.trim(), companionKey);

      await prismadb.companion.update({
        where: {
          id: params.chatId
        },
        data: {
          messages: {
            create: {
              content: response.trim(),
              role: "system",
              userId: user.id,
            },
          },
        }
      });
    }

    return new StreamingTextResponse(s);
  } catch (error) {
    console.log(error)
    return new NextResponse("Internal Error", { status: 500 });
  }
};
