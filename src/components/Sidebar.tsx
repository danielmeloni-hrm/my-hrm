'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutGrid, 
  Ticket, 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  BarChart3, 
  Users,
  LogOut,
  Layers
} from 'lucide-react'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  const menuItems = [
    { name: 'Dashboard Hub', icon: <LayoutGrid size={20} />, path: '/dashboard' },
    { name: 'I miei Ticket', icon: <Ticket size={20} />, path: '/i-miei-ticket' },
    { name: 'Sprint Board', icon: <Layers size={20} />, path: '/board' },, // La board che abbiamo creato
  ]

  return (
    <aside 
      className={`relative flex flex-col h-screen bg-white border-r border-gray-100 transition-all duration-300 shadow-sm z-50 ${
        isCollapsed ? 'w-[70px]' : 'w-[260px]'
      }`}
    >
      {/* HEADER LOGO - Cliccabile per tornare in Home */}
        <Link 
        href="/" 
        className="p-6 flex items-center gap-3 overflow-hidden group cursor-pointer"
        >
        <div className="min-w-[32px] h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0 group-hover:bg-blue-700 transition-colors shadow-sm">
            T
        </div>
        {!isCollapsed && (
            <span className="font-black tracking-tighter text-lg text-gray-900 whitespace-nowrap">
            my<span className="text-blue-600">HRM</span>
            </span>
        )}
        </Link>

      {/* TASTO TOGGLE */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-16 bg-white border border-gray-100 rounded-full p-1 shadow-md hover:text-blue-600 transition-colors z-50"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* MENU NAVIGAZIONE */}
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
            // Gestione stato attivo precisa
            const isActive = pathname === item.path
            
            return (
            <Link 
                key={item.name} 
                href={item.path}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all group ${
                isActive 
                ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50' 
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
                <div className={`shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'group-hover:text-gray-900'}`}>
                {item.icon}
                </div>
                {!isCollapsed && (
                <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">
                    {item.name}
                </span>
                )}
            </Link>
            )
        })}
        </nav>

      {/* FOOTER SIDEBAR */}
      <div className="p-4 border-t border-gray-50 space-y-2">
        <button className="w-full flex items-center gap-4 p-3 text-gray-400 hover:text-gray-900 transition-all overflow-hidden">
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-[13px] font-bold whitespace-nowrap">Impostazioni</span>}
        </button>
        <button className="w-full flex items-center gap-4 p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all overflow-hidden">
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-[13px] font-bold whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  )
}