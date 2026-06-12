import Sidebar from "@/components/Sidebar";
import AiChatWidget from "@/components/ai/AiChatWidget";
import { theme } from "@/styles/theme";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`flex h-screen overflow-hidden ${theme.colors.appBg}`}>
      <Sidebar />

      <main className={theme.layout.main}>
        {children}
        <AiChatWidget />
      </main>
    </div>
  );
}