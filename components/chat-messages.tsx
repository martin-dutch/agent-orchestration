"use client";

import { ElementRef, useEffect, useRef, useState } from "react";
import { Companion } from "@prisma/client";

import { ChatMessage, ChatMessageProps } from "@/components/chat-message";
import { History } from "@/scripts/aibitat";

interface ChatMessagesProps {
  messages: History;
  isLoading: boolean;
  functionCalling: string | undefined
}

export const ChatMessages = ({
  messages = [],
  isLoading,
  functionCalling,
}: ChatMessagesProps) => {
  const scrollRef = useRef<ElementRef<"div">>(null);

  const [fakeLoading, setFakeLoading] = useState(messages.length === 0 ? true : false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFakeLoading(false);
    }, 1000);

    return () => {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);


  return (
    <div className="flex-1 overflow-y-auto pr-4">
      <ChatMessage
        isLoading={fakeLoading}
        // src={companion.src}
        role="system"
        agentName={'system'}
        content={`Hello, I am ${'your assistant'}, ${'and im here to help you orchestrate your swarm or creat new agents for you'}`}
      />
      {messages.map((message, index) => (
        <ChatMessage
          functionCalling={messages.length -1  === index  && message.from !== 'client' ? functionCalling : ''}
          key={index}
          // src={companion.src}
          content={message.content}
          role={message.from=== 'client' ? 'user' : 'system'}
          agentName={message.from}
        />
      ))}
      {isLoading && (
        <ChatMessage
          // src={companion.src}
          role="system"
          isLoading
        />
      )}
      {functionCalling != null && (
        <ChatMessage
          // src={companion.src}
          role="system"
          isLoading
          functionCalling={functionCalling}
        />
      )}
      <div ref={scrollRef} />
    </div>
  );
};
