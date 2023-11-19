"use client";

import { useCompletion } from "ai/react";
import { FormEvent, useEffect, useState } from "react";
import { Companion, Message } from "@prisma/client";
import { useRouter } from "next/navigation";

import { ChatForm } from "@/components/chat-form";
import { ChatHeader } from "@/components/chat-header";
import { ChatMessages } from "@/components/chat-messages";
import { ChatMessageProps } from "@/components/chat-message";
import prismadb from "@/lib/prismadb";
import { History } from "@/scripts/aibitat";

interface ChatClientProps {
  companion: Companion & {
    messages: Message[];
    _count: {
      messages: number;
    }
  };
  chatId: string
};


export const ChatClient = ({
  companion,
  chatId
}: ChatClientProps) => {
  const router = useRouter();
  // const [messages, setMessages] = useState<ChatMessageProps[]>(companion.messages);

  const [companionChate, setCompanionChat] = useState<{history: History; functionCalling: string | undefined} | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await fetch(`/api/chat/multi-agent/${companion.id}/setup`, {
          method: "POST",
          credentials: "same-origin",
          mode: "same-origin",
        });
      } catch (err) {
        console.error(err);
      }
    })();
  }, [companion.id])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/chat/multi-agent/${companion.id}`);
        const result = await response.json();
        console.log('result', result)
        setCompanionChat(result as {history: History; functionCalling:string | undefined});
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    const intervalId = setInterval(fetchData, 1000); // Polls every second

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, [companion.id]);

  console.log('function', companionChate?.functionCalling)
  
  const {
    completion,
    input,
    isLoading,
    handleInputChange,
    handleSubmit,
    setInput,
  } = useCompletion({
    api: `/api/chat/multi-agent/${companion.id}`,
    onFinish(_prompt, completion) {
      // const systemMessage: ChatMessageProps = {
      //   role: "system",
      //   content: completion
      // };

      // setMessages((current) => [...current, systemMessage]);
      // setInput("");

      // router.refresh();
    },
  });


  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const userMessage: ChatMessageProps = {
      role: "user",
      content: input
    };

    // setMessages((current) => [...current, userMessage]);

    handleSubmit(e);
  }


  return (
    <div className="flex flex-col h-full p-4 space-y-2">
      <ChatHeader companion={companion} />
      <ChatMessages
        functionCalling={companionChate?.functionCalling}
        isLoading={isLoading}
        messages={companionChate?.history ?? []}
      />
      <ChatForm 
        isLoading={isLoading} 
        input={input} 
        handleInputChange={handleInputChange} 
        onSubmit={onSubmit} 
      />
    </div>
   );
}
