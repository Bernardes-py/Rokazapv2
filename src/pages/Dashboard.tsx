import { useState } from 'react';
import { MessageSquare, Users, Columns3, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const DEPT_COLORS = ['hsl(142,76%,36%)', 'hsl(210,80%,55%)', 'hsl(45,90%,50%)', 'hsl(0,80%,55%)', 'hsl(280,60%,55%)'];
const DEPARTMENTS = ['Todos', 'Atendente', 'Tecnologia', 'Comercial', 'Contabilidade', 'Financeiro'];

export default function Dashboard() {
  const { appUser } = useAuth();
  const [filterDept, setFilterDept] = useState('Todos');
  const { stats, loading, isAdmin } = useDashboardStats(appUser?.uid, appUser?.department, filterDept);

  const isFiltering = isAdmin && filterDept !== 'Todos';

  const statCards = [
    { title: 'Conversas ativas', value: stats.activeConversations, icon: MessageSquare, color: 'hsl(142,76%,36%)' },
    ...(isAdmin ? [{ title: 'Usuários', value: stats.totalUsers, icon: Users, color: 'hsl(var(--primary))' }] : []),
    { title: 'Tarefas Kanban', value: stats.kanbanCards, icon: Columns3, color: 'hsl(210,80%,55%)' },
    { title: 'Atendimentos hoje', value: stats.todayInteractions, icon: TrendingUp, color: 'hsl(45,90%,50%)' },
  ];

  const deptData = Object.entries(stats.departmentCounts).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-card p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin
              ? isFiltering
                ? `Filtrando por departamento: ${filterDept}`
                : 'Visão geral do sistema'
              : `Visão do departamento ${appUser?.department}`}
          </p>
        </div>
        {isAdmin && (
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[200px] bg-card border-border">
              <SelectValue placeholder="Filtrar departamento" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {statCards.map((s) => (
          <Card key={s.title} className="bg-card/90 border-border backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <s.icon className="h-5 w-5" style={{ color: s.color }} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && !isFiltering && deptData.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card/90 border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Usuários por Departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="bg-card/90 border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Equipe por Departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={deptData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(142,76%,36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
