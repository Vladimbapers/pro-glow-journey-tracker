import { useEffect, useState } from 'react';
import { Dumbbell, Plus, Edit2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import GoalSetting from '@/components/goals/GoalSetting';
import { Goal, GoalFormData } from '@/components/goals/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const rowToGoal = (r: any): Goal => ({
  id: r.id,
  title: r.title,
  description: '',
  category: r.category,
  startValue: 0,
  currentValue: Number(r.progress ?? 0),
  targetValue: Number(r.target ?? 0),
  unit: r.unit ?? '',
  deadline: r.deadline ?? '',
  createdAt: r.created_at,
});

const Goals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setGoals((data ?? []).map(rowToGoal));
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleAdd = async (g: GoalFormData) => {
    if (!user) return;
    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      category: g.category,
      title: g.title,
      target: g.targetValue,
      unit: g.unit,
      deadline: g.deadline || null,
      progress: g.currentValue,
    });
    if (error) { toast.error('Could not save goal'); return; }
    setIsOpen(false);
    await load();
  };

  const handleUpdate = async (g: Goal) => {
    const { error } = await supabase.from('goals').update({
      category: g.category,
      title: g.title,
      target: g.targetValue,
      unit: g.unit,
      deadline: g.deadline || null,
      progress: g.currentValue,
    }).eq('id', g.id);
    if (error) { toast.error('Could not update goal'); return; }
    setIsOpen(false);
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) { toast.error('Could not delete goal'); return; }
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const editingGoal = editingId ? goals.find((g) => g.id === editingId) ?? null : null;

  return (
    <div className="container mx-auto py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Dumbbell className="mr-2 h-6 w-6 text-proglo-purple" />
          <h1 className="text-3xl font-bold proglo-gradient-text">Your Goals</h1>
        </div>
        <Button onClick={() => { setEditingId(null); setIsOpen(true); }} className="bg-proglo-purple hover:bg-proglo-dark-purple">
          <Plus className="mr-2 h-4 w-4" />
          Add New Goal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => (
          <Card key={goal.id} className="fitness-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium leading-none flex items-center">
                {goal.title}
                <span className="ml-2 workout-tag">{goal.category}</span>
              </CardTitle>
              <div className="flex space-x-2">
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(goal.id); setIsOpen(true); }}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>{goal.currentValue} {goal.unit}</span>
                  <span>{goal.targetValue} {goal.unit}</span>
                </div>
                <Progress value={(goal.currentValue / Math.max(goal.targetValue, 1)) * 100} className="h-2 rounded-full" />
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-xs text-gray-500">Deadline: {goal.deadline || '—'}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {goals.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">No goals yet. Add your first one!</p>
        )}
      </div>

      <GoalSetting
        open={isOpen}
        onClose={() => { setIsOpen(false); setEditingId(null); }}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        goal={editingGoal}
      />
    </div>
  );
};

export default Goals;
