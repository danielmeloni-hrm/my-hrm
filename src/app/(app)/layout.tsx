import Sidebar from "@/components/Sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FBFBFB]">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto relative">
        {children}
      </main>
    </div>
  )
}