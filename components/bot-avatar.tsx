import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Card } from "./ui/card";

interface BotAvatarProps {
  src: string;
  agentName: string;
};

export const BotAvatar = ({
  src,
  agentName
}: BotAvatarProps) => {
  console.log('agentName PRINT', agentName)
  return (
<Card className="w-48 p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg transition-shadow duration-200">
<div className="flex items-center space-x-4">
<Avatar className="h-12 w-12">
      <AvatarImage src={src} />
      {/* <h3>{agentName}</h3> */}
    </Avatar>
  <div>
    <h2 className="text-gray-800 dark:text-white font-semibold">{agentName}</h2>
    {/* <p className="text-gray-500 dark:text-gray-300">{agentRole}</p> */}
  </div>
</div>
</Card>);
};
