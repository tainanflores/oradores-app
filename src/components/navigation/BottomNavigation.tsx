import { Link, useLocation } from "react-router-dom";

function BottomNavigation() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Agenda", icon: "📅" },
    { path: "/oradores", label: "Oradores", icon: "👤" },
    { path: "/temas", label: "Esboços", icon: "📚" },
    { path: "/saidas", label: "Saídas", icon: "🚗" },
    { path: "/config", label: "Config", icon: "⚙️" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl border-purple-400 shadow-lg border-t-3 border-gradient-to-r">
      <div className="flex justify-around ">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-18 h-18 mx-1 rounded-lg transition-colors  ${
                isActive
                  ? "text-purple-600 bg-purple-50 bg-gradient-to-r from-purple-200 to-purple-100"
                  : "text-gray-500 hover:text-purple-600 hover:bg-gray-50"
              }`}
              style={{ minWidth: "4rem", minHeight: "4rem" }}
            >
              <span className="text-lg mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
