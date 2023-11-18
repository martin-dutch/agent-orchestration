import { redirect } from "next/navigation";
import { auth, redirectToSignIn } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { checkSubscription } from "@/lib/subscription";
import { AgentForm } from "./components/agent-form";


interface CompanionIdPageProps {
  params: {
    agentId: string;
  };
};

const CompanionIdPage = async ({
  params
}: CompanionIdPageProps) => {
  const { userId } = auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const validSubscription = await checkSubscription();

  if (!validSubscription) {
    return redirect("/");
  }

  const agent = await prismadb.agent.findUnique({
    where: {
      id: params.agentId,
      userId,
    }
  });

  const categories = await prismadb.category.findMany();

  return ( 
    <AgentForm initialData={agent} categories={categories} />
  );
}
 
export default CompanionIdPage;
