import { StatusDashboard } from "@/components/status-dashboard";
import { getWeatherStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await getWeatherStatus();

  return <StatusDashboard initialStatus={status} />;
}
