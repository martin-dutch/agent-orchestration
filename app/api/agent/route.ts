import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { checkSubscription } from "@/lib/subscription";

import OpenAI from 'openai'

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await currentUser();
    const { src, name, description, instructions, role, seed } = body;
    console.log(body)

    if (!user || !user.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!src || !name  || !instructions) {
      return new NextResponse("Missing required fields", { status: 400 });
    };

    const isPro = await checkSubscription();

    if (!isPro) {
      return new NextResponse("Pro subscription required", { status: 403 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const thread = await openai.beta.threads.create({});

    const desc = 'desc'
    const companion = await prismadb.agent.create({
      data: {
        userId: user.id,
        userName: user.firstName,
        src,
        role,
        seed,
        name,
        description: desc,
        instructions,
      }
    });

    return NextResponse.json(companion);
  } catch (error) {
    console.log("[COMPANION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
};
