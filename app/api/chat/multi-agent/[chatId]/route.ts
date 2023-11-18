import dotenv from "dotenv";
import { StreamingTextResponse, LangChainStream } from "ai";
import { auth, currentUser } from "@clerk/nextjs";
import { Replicate } from "langchain/llms/replicate";
import { CallbackManager } from "langchain/callbacks";
import { NextResponse } from "next/server";
import OpenAI from 'openai'

import { MemoryManager } from "@/lib/memory";
import prismadb from "@/lib/prismadb";
import AIbitat from "@/scripts/aibitat";
import { experimental_webBrowsing } from "@/scripts/aibitat/plugins";




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

  export async function GET(
    request: Request,
    { params }: { params: { chatId: string } }
  ) {
    const user = await currentUser();
    console.log('user', user)
    const chatId = params.chatId;
    console.log('chatId', chatId)

    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  
    const companion = await prismadb.companion.findUnique({
      where: {
        id: params.chatId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          where: {
            userId: user.id,
          },
        },
        _count: {
          select: {
            messages: true,
          }
        }
      }
    });
  

    return new NextResponse(JSON.stringify(companion))
  }


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
    
    const aibitat = new AIbitat()
        .use(experimental_webBrowsing())
        .agent('client', {
            interrupt: 'ALWAYS',
            role: 'You are a human assistant. Reply "TERMINATE" when there is a correct answer or there`s no answer to the question.',
            functions: ['web-browsing'],
        })
        .agent('mathematician', {
            role: `You are a researcher and look at the web or internet for answers`,
            functions: ['web-browsing'],
        })
        .agent('reviewer', {
            role: `You are a Peer-Reviewer and you do not answer questions. 
            Check the result from @mathematician and then confirm. Just confirm, no talk.`,
        })
        .channel('management', ['mathematician', 'reviewer', 'client'])

        // aibitat.onMessage(console.log)
        var Readable = require("stream").Readable;
        let s = new Readable();
        // s.push(response);
        // s.push(null);

        aibitat.onInterrupt((chat) => {
        })

        // aibitat.onMessage((chat) => {
        //     console.log('init chat')
        //     s.push(chat.content);
        //     console.log('chat', chat)
        //     // state: 'success' | 'interrupt' | 'error'
        //     // if(chat.state === 'interrupted') {
        //     //     inst.interrupt()
        //     // }
        //     // if (chat.content === 'TERMINATE') {
        //     //     inst.interrupt()
        //     // }
        // })


        aibitat.onMessage(async (chat) => {
          {chat.from !== 'client' && await prismadb.companion.update({
            where: {
              id: params.chatId
            },
            data: {
              messages: {
                create: {
                  content: chat.content ?? '',
                  role: "system",
                  agentName: chat.from,
                  userId: user.id,
                },
              },
            }
          });}
        })
        
    await aibitat.start({
        from: 'client',
        to: 'management',
        content: prompt,
    })

    // console.log(aibitat.chats)
    

    aibitat.chats.forEach((chat) => {
        s.push(chat.content);
    })
    s.push(null);



    return new StreamingTextResponse(s);
  } catch (error) {
    console.log(error)
    return new NextResponse("Internal Error", { status: 500 });
  }
};
