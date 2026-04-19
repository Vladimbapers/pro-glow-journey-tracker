import { useEffect, useState } from 'react';
import { Apple, Filter, Utensils, Coffee, FileBarChart } from 'lucide-react';
import NutritionTracker, { NutritionEntry } from '@/components/tracking/NutritionTracker';
import HydrationTracker from '@/components/tracking/HydrationTracker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthUser } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type NutritionProps = { user: AuthUser | null };

const Nutrition = ({ user }: NutritionProps) => {
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [hydrationGoal] = useState(2000);
  const [currentHydration, setCurrentHydration] = useState(0);

  const load = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: nutri }, { data: hydro }] = await Promise.all([
      supabase.from('nutrition_entries').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }),
      supabase.from('hydration_entries').select('amount_ml, recorded_at').eq('user_id', user.id).gte('recorded_at', today),
    ]);

    setEntries(
      (nutri ?? []).map((n: any) => ({
        id: n.id,
        food: n.food_name,
        category: 'other',
        portion: 'medium',
        mealTime: n.meal,
        date: n.recorded_at?.slice(0, 10) ?? '',
      }))
    );
    setCurrentHydration((hydro ?? []).reduce((sum: number, h: any) => sum + (h.amount_ml ?? 0), 0));
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleAddNutritionEntry = async (data: Omit<NutritionEntry, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('nutrition_entries').insert({
      user_id: user.id,
      meal: data.mealTime,
      food_name: data.food,
      recorded_at: data.date,
    });
    if (error) { toast.error('Could not save meal'); return; }
    await load();
  };

  const handleAddWater = async (amount: number) => {
    if (!user) return;
    const { error } = await supabase.from('hydration_entries').insert({ user_id: user.id, amount_ml: amount });
    if (error) { toast.error('Could not log water'); return; }
    setCurrentHydration((prev) => prev + amount);
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((e) => e.date === today);
  const mealDistribution = {
    breakfast: todayEntries.filter((e) => e.mealTime === 'breakfast').length,
    lunch: todayEntries.filter((e) => e.mealTime === 'lunch').length,
    dinner: todayEntries.filter((e) => e.mealTime === 'dinner').length,
    snack: todayEntries.filter((e) => e.mealTime === 'snack').length,
  };

  return (
    <div className="space-y-8">
      <div className="proglo-section-header">
        <h1 className="text-3xl font-bold proglo-gradient-text flex items-center">
          <Utensils className="mr-2 text-proglo-purple" size={28} />
          Nutrition & Hydration
        </h1>
        <p className="text-gray-600 mt-1">Track your meals and water intake</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 animate-fade-in">
          <NutritionTracker entries={entries} onAddEntry={handleAddNutritionEntry} />
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <HydrationTracker dailyGoal={hydrationGoal} currentIntake={currentHydration} onAddWater={handleAddWater} />
          </div>

          <Card className="proglo-card animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <CardHeader className="proglo-card-header">
              <CardTitle className="text-lg font-semibold flex items-center">
                <FileBarChart size={18} className="mr-2 text-proglo-purple" />
                Today's Meal Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(mealDistribution).map(([meal, count]) => (
                  <div key={meal} className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center">
                    <div className="mb-1">
                      {meal === 'breakfast' && <Coffee size={18} className="inline text-orange-500 mr-1" />}
                      {meal === 'lunch' && <Utensils size={18} className="inline text-green-500 mr-1" />}
                      {meal === 'dinner' && <Utensils size={18} className="inline text-blue-500 mr-1" />}
                      {meal === 'snack' && <Apple size={18} className="inline text-red-500 mr-1" />}
                    </div>
                    <p className="text-sm font-medium capitalize">{meal}</p>
                    <p className="text-lg font-bold text-proglo-purple">{count}</p>
                    <p className="text-xs text-gray-500">{count === 1 ? 'item' : 'items'}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-3 bg-blue-50 rounded-md border border-blue-100">
                <h4 className="text-sm font-medium text-blue-800 flex items-center">
                  <Filter size={16} className="mr-1" />
                  Nutrition Tips
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  Try to include protein with every meal and aim for at least 5 servings of fruits and vegetables daily.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Nutrition;
