import Sidebar from "@/components/Sidebar"
import AiChatWidget from "@/components/ai/AiChatWidget";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FBFBFB]">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto relative">
        {children}
         <AiChatWidget />
      </main>
    </div>
  )
}