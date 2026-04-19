import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import BMICalculator from '@/components/bmi/BMICalculator';
import ProgressChart from '@/components/charts/ProgressChart';
import { AuthUser } from '@/types/auth';
import { Activity, TrendingDown, Award, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type BMIProps = {
  user: AuthUser | null;
  setUser: (userData: Partial<AuthUser>) => Promise<AuthUser | undefined>;
};

const categorize = (bmi: number) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy Weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

const BMI = ({ user, setUser }: BMIProps) => {
  const [bmiHistory, setBMIHistory] = useState<{ date: string; value: number }[]>([]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bmi_entries')
      .select('bmi, recorded_at')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true });
    setBMIHistory((data ?? []).map((d: any) => ({ date: d.recorded_at, value: Number(d.bmi) })));
  };

  useEffect(() => { loadHistory(); }, [user?.id]);

  const handleSave = async (height: number, weight: number, bmi: number) => {
    if (!user) return;
    await setUser({ height, weight });
    const { error } = await supabase.from('bmi_entries').insert({
      user_id: user.id,
      height,
      weight,
      bmi,
      category: categorize(bmi),
    });
    if (error) {
      toast.error('Could not save BMI');
      return;
    }
    await loadHistory();
  };

  return (
    <div className="space-y-8">
      <div className="proglo-section-header">
        <h1 className="text-3xl font-bold proglo-gradient-text flex items-center">
          <Activity className="mr-2 text-proglo-purple" size={28} />
          BMI Tracker
        </h1>
        <p className="text-gray-600 mt-1">Monitor your Body Mass Index over time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="animate-fade-in">
          <BMICalculator user={user} onSave={handleSave} />
        </div>

        <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Card className="overflow-hidden border-purple-100 shadow-md proglo-card">
            <div className="proglo-card-header">
              <h3 className="text-xl font-semibold proglo-gradient-text flex items-center">
                <TrendingDown className="mr-2" size={18} />
                Progress History
              </h3>
            </div>
            <CardContent className="pt-6">
              <ProgressChart data={bmiHistory} label="BMI History" color="#9b87f5" height={220} />
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gradient-to-b from-blue-50 to-white p-3 rounded-md border border-blue-100 text-center">
                  <p className="text-xs text-gray-600">Underweight</p>
                  <p className="text-sm font-medium text-blue-600">Below 18.5</p>
                </div>
                <div className="bg-gradient-to-b from-green-50 to-white p-3 rounded-md border border-green-100 text-center">
                  <Award className="h-3 w-3 mx-auto mb-1 text-green-600" />
                  <p className="text-xs text-gray-600">Healthy Weight</p>
                  <p className="text-sm font-medium text-green-600">18.5 - 24.9</p>
                </div>
                <div className="bg-gradient-to-b from-orange-50 to-white p-3 rounded-md border border-orange-100 text-center">
                  <p className="text-xs text-gray-600">Overweight</p>
                  <p className="text-sm font-medium text-orange-600">25 - 29.9</p>
                </div>
                <div className="bg-gradient-to-b from-red-50 to-white p-3 rounded-md border border-red-100 text-center">
                  <p className="text-xs text-gray-600">Obese</p>
                  <p className="text-sm font-medium text-red-600">30 or higher</p>
                </div>
              </div>
              <div className="mt-6 flex items-start p-3 bg-blue-50 rounded-md border border-blue-100">
                <Info className="h-5 w-5 text-blue-500 mr-2 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600">
                  BMI is a screening tool, not a diagnostic tool. Consult with a healthcare provider to evaluate your overall health and risks.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BMI;
