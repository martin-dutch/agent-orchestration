"use client";

import { useUser } from "@clerk/nextjs";

import { Avatar, AvatarImage } from "@/components/ui/avatar"

export const UserAvatar = ({
  agentName
}:{
  agentName: string
}) => {
  const { user } = useUser();

  return (
    <Avatar className="h-12 w-12">
      <AvatarImage src={user?.imageUrl} />
      <h3>{agentName}</h3>
    </Avatar>
  );
};
