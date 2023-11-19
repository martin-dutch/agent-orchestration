"use client";

import { ElementRef, useEffect, useRef, useState } from "react";
import { Companion } from "@prisma/client";

import { ChatMessage, ChatMessageProps } from "@/components/chat-message";
import { History } from "@/scripts/aibitat";

interface ChatMessagesProps {
  messages: History;
  isLoading: boolean;
  companion: Companion
}

export const ChatMessages = ({
  messages = [],
  isLoading,
  companion,
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
        src={companion.src}
        role="system"
        agentName={'system'}
        content={`Hello, I am ${companion.name}, ${companion.description}`}
      />
      {messages.map((message, index) => (
        <ChatMessage
          functionCalling={messages.length -1  === index  ? companion.functionCalling : ''}
          key={index}
          src={companion.src}
          content={message.content}
          role={message.from=== 'client' ? 'user' : 'system'}
          agentName={message.from}
        />
      ))}
      {isLoading && (
        <ChatMessage
          src={companion.src}
          role="system"
          isLoading
        />
      )}
      <div ref={scrollRef} />
    </div>
  );
};
