import dotenv from "dotenv";
import { StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { MemoryManager } from "@/lib/memory";
import prismadb from "@/lib/prismadb";
import AIbitat from "@/scripts/aibitat";
import { agents } from "@/scripts/aibitat/plugins/agents";

dotenv.config({ path: `.env` });

// Hardcoded assistant details
const ASSISTANT_NAME = "My Assistant with a custom tool to add two numbers";
const ASSISTANT_MODEL = "gpt-4-1106-preview";
const ASSISTANT_DESCRIPTION =
  "A friendly assistant to help you with your queries.";

const aibitat = new AIbitat()
  .use(agents({ dbClient: prismadb }))
  .agent("client", {
    interrupt: "ALWAYS",
    role: `
    You are a human assistant. 
    Reply "TERMINATE" when there is a correct answer or there's no answer to the question.`,
  })
  .agent("agents", {
    role: `
    You are a human assistant. 
    Reply "TERMINATE" when there is a correct answer or there's no answer to the question.`,
    functions: ["list-running-agents", "create-agent-for-url"],
  })
  .channel("broadcast", ["client", "agents"]);

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
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        where: {
          userId: user.id,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  return new NextResponse(JSON.stringify(companion));
}

export async function PUT(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  const user = await currentUser();
  const chatId = params.chatId;

  if (!user || !user.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  aibitat.onInterrupt((chat) => {});

  aibitat.onMessage(async (chat) => {
    await prismadb.companion.update({
      where: {
        id: params.chatId,
      },
      data: {
        messages: {
          create: {
            content: chat.content ?? "",
            role: "system",
            agentName: chat.from,
            userId: user.id,
          },
        },
      },
    });
  });
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

    // TODO: check if we actually need this now
    const companion = await prismadb.companion.update({
      where: {
        id: params.chatId,
      },
      data: {
        messages: {
          create: {
            content: prompt,
            role: "user",
            userId: user.id,
          },
        },
      },
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
