import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardGreeting from '@/components/dashboard/DashboardGreeting';
import StatsOverview from '@/components/dashboard/StatsOverview';
import WeightTracker from '@/components/dashboard/WeightTracker';
import BMISummary from '@/components/dashboard/BMISummary';
import RecentActivities from '@/components/dashboard/RecentActivities';
import NutritionSummary from '@/components/dashboard/NutritionSummary';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user } = useAuth();
  const [latestBmi, setLatestBmi] = useState<{ bmi_value: number; category: string } | null>(null);
  const [weightData, setWeightData] = useState<{ date: string; value: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('bmi_entries')
          .select('bmi, weight, category, recorded_at')
          .eq('user_id', user.id)
          .order('recorded_at', { ascending: false });

        if (data && data.length > 0) {
          setLatestBmi({ bmi_value: Number(data[0].bmi), category: data[0].category ?? 'Healthy Weight' });
          setWeightData(
            [...data].reverse().map((d: any) => ({ date: d.recorded_at, value: Number(d.weight) }))
          );
        } else {
          setWeightData([]);
        }
      } catch (e) {
        console.error('Dashboard load error', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  return (
    <div className="space-y-8">
      <DashboardGreeting name={user?.name || 'User'} />
      <StatsOverview />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 stagger-animate-2">
          <WeightTracker data={weightData} />
        </div>
        <div className="lg:col-span-1 stagger-animate-2" style={{ animationDelay: "0.2s" }}>
          <BMISummary bmiData={latestBmi} isLoading={isLoading} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stagger-animate-3"><RecentActivities /></div>
        <div className="stagger-animate-3" style={{ animationDelay: "0.2s" }}><NutritionSummary /></div>
      </div>
    </div>
  );
};

export default Dashboard;
