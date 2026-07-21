import Sidebar from "@/components/Sidebar";
import AiChatWidget from "@/components/ai/AiChatWidget";
import TicketChangeToaster from "@/components/notifications/TicketChangeToaster";
import { theme } from "@/styles/theme";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`flex h-screen overflow-hidden ${theme.colors.appBg}`}>
      <Sidebar />

      {/* pt-14 su mobile: lascia spazio alla barra superiore fissa */}
      <main className={`${theme.layout.main} pt-14 md:pt-0`}>
        {children}
        <AiChatWidget />
        <TicketChangeToaster />
      </main>
    </div>
  );
}