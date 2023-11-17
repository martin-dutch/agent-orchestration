
import { checkSubscription } from "@/lib/subscription";

const SettingsPage = async () => {
  const isPro = await checkSubscription();

  return ( 
    <div className="h-full p-4 space-y-2">
      <h3 className="text-lg font-medium">Settings</h3>
      <div className="text-muted-foreground text-sm">
        {true ? "You are currently on a Pro plan." : "You are currently on a free plan."}
      </div>
    </div>
   );
}
 
export default SettingsPage;
