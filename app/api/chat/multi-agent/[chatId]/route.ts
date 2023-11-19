import dotenv from "dotenv";
import { StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { MemoryManager } from "@/lib/memory";
import prismadb from "@/lib/prismadb";
import AIbitat from "@/scripts/aibitat";
import { agents } from "@/scripts/aibitat/plugins/agents";
import { youCom } from "@/scripts/aibitat/plugins/you-com";

dotenv.config({ path: `.env` });

export const aibitat = new AIbitat()
  .use(agents({ dbClient: prismadb }))
  .use(youCom({}))
  .agent("client", {
    interrupt: "ALWAYS",
    role: `
    You are a human assistant. 
    Reply "TERMINATE" when there is a correct answer or there's no answer to the question.`,
  })
  .agent("agent-manager", {
    role: `
    You are the agent manager.
    Your job is to create and manage agents.`,
    functions: ["list-running-agents", "create-agent-for-url"],
  })
  .agent("you.com-search", {
    role: `
    You are a search assistant powered by you.com.
    Your job is to find relevant websites to turn into agents.`,
    functions: ["search-for-websites"],
  })
  .channel("broadcast", ["client", "agent-manager", "you.com-search"]);

export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  const user = await currentUser();
  const chatId = params.chatId;

  if (!user || !user.firstName || !user.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const companion = await prismadb.companion.findUnique({
    where: {
      id: params.chatId,
    }
  });

  return new NextResponse(JSON.stringify({history: aibitat.chats, companion: companion }));
}

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json();
    const user = await currentUser();

    if (!user || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    aibitat.onInterrupt((chat) => {});

    aibitat.onMessage(async (chat) => {
      console.log('ONMESSAGE', chat)
    })

    aibitat.onFunction(async (func) => {
      console.log('CALLING FUNCITON', func)
    })

    await aibitat.start({
      from: "client",
      to: "broadcast",
      content: prompt,
    });
  } catch (error) {
    console.log(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
