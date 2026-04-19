import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';

const MIGRATED_FLAG = 'proglo_migrated_to_supabase_v1';

const safeRead = async <T,>(key: string): Promise<T[]> => {
  try {
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
};

const run = (qb: any): Promise<any> => Promise.resolve(qb);

/**
 * One-time best-effort import of legacy localStorage health data into Supabase
 * for the currently logged-in user. Only runs once per device.
 */
export const migrateLocalStorageToSupabase = async (userId: string) => {
  const flag = await Preferences.get({ key: MIGRATED_FLAG });
  if (flag.value === 'true') return;

  const [bmi, activities, nutrition, sleep, hydration, goals] = await Promise.all([
    safeRead<any>('proglo_bmi_records'),
    safeRead<any>('proglo_activities'),
    safeRead<any>('proglo_nutrition'),
    safeRead<any>('proglo_sleep'),
    safeRead<any>('proglo_hydration'),
    safeRead<any>('proglo_goals'),
  ]);

  const inserts: Promise<any>[] = [];

  if (bmi.length) {
    inserts.push(run(supabase.from('bmi_entries').insert(
      bmi.map((r) => ({
        user_id: userId,
        height: r.height,
        weight: r.weight,
        bmi: r.bmi_value ?? r.bmi,
        category: r.category,
        recorded_at: r.date ?? new Date().toISOString(),
      }))
    )));
  }
  if (activities.length) {
    inserts.push(run(supabase.from('activities').insert(
      activities.map((a) => ({
        user_id: userId,
        type: a.type,
        duration_minutes: a.duration,
        calories_burned: a.calories_burned ?? null,
        notes: a.intensity ? `intensity: ${a.intensity}` : null,
        recorded_at: a.date ?? new Date().toISOString(),
      }))
    )));
  }
  if (nutrition.length) {
    inserts.push(run(supabase.from('nutrition_entries').insert(
      nutrition.map((n) => ({
        user_id: userId,
        meal: n.mealTime ?? n.meal ?? 'snack',
        food_name: n.food ?? n.food_name ?? 'Item',
        calories: n.calories ?? null,
        protein: n.proteins ?? null,
        carbs: n.carbs ?? null,
        fat: n.fats ?? null,
        recorded_at: n.date ?? new Date().toISOString(),
      }))
    )));
  }
  if (sleep.length) {
    inserts.push(run(supabase.from('sleep_entries').insert(
      sleep.map((s) => ({
        user_id: userId,
        hours: s.hoursslept ?? s.hoursSlept ?? s.hours,
        quality: s.quality ?? null,
        recorded_at: s.date ?? new Date().toISOString(),
      }))
    )));
  }
  if (hydration.length) {
    inserts.push(run(supabase.from('hydration_entries').insert(
      hydration.map((h) => ({
        user_id: userId,
        amount_ml: h.amount,
        recorded_at: h.date ?? new Date().toISOString(),
      }))
    )));
  }
  if (goals.length) {
    inserts.push(run(supabase.from('goals').insert(
      goals.map((g) => ({
        user_id: userId,
        category: g.category,
        title: g.title,
        target: g.targetvalue ?? g.targetValue,
        unit: g.unit,
        deadline: g.deadline ?? null,
        progress: g.currentvalue ?? g.currentValue ?? 0,
        completed: g.completed ?? false,
      }))
    )));
  }

  await Promise.allSettled(inserts);
  await Preferences.set({ key: MIGRATED_FLAG, value: 'true' });
};
