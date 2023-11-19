/**
 * v0 by Vercel.
 * @see https://v0.dev/t/vHa5jiVrkHI
 */
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar"
import { CardTitle, CardDescription, CardHeader, CardContent, Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function RobCard({
    name,
    role,
    functions,
}: {
    name: string;
    role: string
    functions: string[]
}) {
  return (
<Card>
<CardHeader>
  <div className="flex items-center gap-4">
    <Avatar>
        <AvatarImage src={`https://gravatar.com/avatar/${name}?d=robohash`} />
      <AvatarFallback>PP</AvatarFallback>
    </Avatar>
    <div>
      <CardTitle>{`Name: ${name}`}</CardTitle>
      <CardDescription>{`Role: ${role}`}</CardDescription>
    </div>
  </div>
</CardHeader>
<CardContent>
  <p className="mb-2 font-semibold">Functions:</p>
  <div className="flex gap-2 overflow-auto">
    {functions.slice(0).reverse().map((func, index) => (
        <Badge key={index} className="p-1 bg-blue-100 text-blue-800">{func}</Badge>
    ))}
  </div>
</CardContent>
</Card>
  )
}
