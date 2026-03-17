import { LayoutDashboard, MessageSquare, Columns3, Settings, LogOut, UserRoundSearch, Building2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import sindicoLogo from '@/assets/sindico-x-logo-white.jpg';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Cadastro', url: '/cadastro', icon: UserRoundSearch },
  { title: 'WhatsApp', url: '/whatsapp', icon: MessageSquare },
  { title: 'Kanban', url: '/kanban', icon: Columns3 },
];

export function AppSidebar() {
  const { signOut, appUser } = useAuth();
  const isAdmin = appUser?.profile === 'admin';

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="flex items-center justify-center px-4 py-5">
          <div className="rounded-lg bg-white px-3 py-1.5">
            <img
              src={sindicoLogo}
              alt="Síndico X"
              className="h-7 w-auto object-contain"
            />
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-primary/15 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/tenants"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        activeClassName="bg-primary/15 text-primary font-medium"
                      >
                        <Building2 className="h-5 w-5" />
                        <span>Condomínios</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/settings"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        activeClassName="bg-primary/15 text-primary font-medium"
                      >
                        <Settings className="h-5 w-5" />
                        <span>Configurações</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{appUser?.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{appUser?.department}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-sidebar-foreground/50 hover:text-destructive shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
