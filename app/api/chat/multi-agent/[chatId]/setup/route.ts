import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { aibitat } from "../route";

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  
  try {
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
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}