import { LayoutDashboard, FolderOpen, ScanBarcode, FileText, History, Package, Users, Truck, Settings, MapPin, Shield, CheckSquare, BookOpen, Receipt, AlertCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Inventory", url: "/categories", icon: FolderOpen, permission: "inventory" },
  { title: "Scan", url: "/scan", icon: ScanBarcode, permission: "scan" },
  { title: "Personal Inventory", url: "/personal-inventory", icon: Users, permission: "personal-inventory" },
  { title: "Delivery Challans", url: "/delivery-challans", icon: Truck, permission: "delivery-challans" },
  { title: "Invoices", url: "/invoices", icon: Receipt, permission: "invoices" },
  { title: "Technical Details", url: "/sites", icon: MapPin, permission: "sites" },
  { title: "Complaints", url: "/complaints", icon: AlertCircle, permission: "complaints" },
  { title: "Projects Tracking", url: "/projects", icon: CheckSquare, permission: "project-tracking" },
  { title: "Knowledge Base", url: "/knowledge-base", icon: BookOpen },
  { title: "Reports", url: "/reports", icon: FileText, permission: "reports" },
  { title: "Transactions", url: "/transactions", icon: History, permission: "transactions" },
  { title: "Settings", url: "/settings", icon: Settings, permission: "settings" },
];

const adminItems = [
  { title: "Manage Users", url: "/manage-users", icon: Shield },
  { title: "Profile", url: "/profile", icon: Users },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, appUser } = useAuth();

  // Close mobile sidebar when a menu item is clicked
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" onClick={handleNavClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-800">
            <Package className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">Avira Technologies</span>
              <span className="text-xs text-sidebar-foreground/60">Project Management Portal</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter((item) => {
                  // Admins see all items, regular users see only items they have permission for
                  if (isAdmin) return true;
                  // Items without a permission requirement are always shown
                  if (!item.permission) return true;
                  return appUser?.permissions?.includes(item.permission);
                })
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={handleNavClick}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/profile"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={handleNavClick}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
