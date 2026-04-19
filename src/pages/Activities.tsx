import { useEffect, useState } from 'react';
import { Activity, TrendingUp, Calendar, Award } from 'lucide-react';
import ActivityTracker, { Activity as ActivityType } from '@/components/tracking/ActivityTracker';
import ProgressChart from '@/components/charts/ProgressChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthUser } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ActivitiesProps = { user: AuthUser | null };

const Activities = ({ user }: ActivitiesProps) => {
  const [activities, setActivities] = useState<ActivityType[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false });

    setActivities(
      (data ?? []).map((a: any) => ({
        id: a.id,
        type: a.type,
        duration: a.duration_minutes,
        intensity: (a.notes ?? '').replace('intensity: ', '') || 'medium',
        date: a.recorded_at?.slice(0, 10) ?? '',
      }))
    );
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleAddActivity = async (data: Omit<ActivityType, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('activities').insert({
      user_id: user.id,
      type: data.type,
      duration_minutes: data.duration,
      notes: `intensity: ${data.intensity}`,
      recorded_at: data.date,
    });
    if (error) { toast.error('Could not save activity'); return; }
    await load();
  };

  // Build last-7-day chart
  const today = new Date();
  const chart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const value = activities.filter((a) => a.date === key).reduce((s, a) => s + a.duration, 0);
    return { date: key, value };
  });

  return (
    <div className="space-y-8">
      <div className="proglo-section-header">
        <h1 className="text-3xl font-bold proglo-gradient-text flex items-center">
          <Activity className="mr-2 text-proglo-purple" size={28} />
          Activity Tracker
        </h1>
        <p className="text-gray-600 mt-1">Log and monitor your fitness activities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 animate-fade-in">
          <ActivityTracker activities={activities} onAddActivity={handleAddActivity} />
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-6">
            <Card className="proglo-card animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardHeader className="proglo-card-header">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <TrendingUp size={18} className="mr-2 text-proglo-purple" />
                  Weekly Activity Minutes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ProgressChart data={chart} label="Minutes of Activity" color="#9b87f5" unit=" min" height={220} />
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between text-sm bg-purple-50 p-3 rounded-md border border-purple-100">
                    <span className="flex items-center"><Award size={16} className="mr-2 text-proglo-purple" />Total this week:</span>
                    <span className="font-medium">{chart.reduce((t, d) => t + d.value, 0)} minutes</span>
                  </div>
                  <div className="flex justify-between text-sm bg-purple-50 p-3 rounded-md border border-purple-100">
                    <span className="flex items-center"><Calendar size={16} className="mr-2 text-proglo-purple" />Active days:</span>
                    <span className="font-medium">{chart.filter((d) => d.value > 0).length}/7 days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Activities;
