"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首页看板", icon: "📊" },
  { href: "/input", label: "问题输入", icon: "✏️" },
  { href: "/ledger", label: "闭环台账", icon: "📋" },
  { href: "/documents", label: "成果输出", icon: "📄" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-800 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">监理巡视闭环智能体</h1>
        <p className="text-xs text-slate-400 mt-1">工程监理AI辅助系统</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-slate-700 text-white border-r-4 border-blue-400"
                  : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          智巡工匠队 · 咨询公司项管公司
        </p>
        <p className="text-xs text-slate-600 mt-1">v1.0.0</p>
      </div>
    </aside>
  );
}
