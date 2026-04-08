// ============================================
// SUPABASE — Auth + Database Layer
// ============================================

// Load Supabase client from CDN (loaded before this script)
let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ---------- AUTH ----------

async function signUp(email, password) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  return { data, error };
}

async function signIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  return { error };
}

async function getSession() {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session;
}

async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

// ---------- FOOD ENTRIES ----------

async function fetchFoodEntries(userId, date) {
  const { data, error } = await getSupabase()
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true });
  if (error) console.error('fetchFoodEntries:', error);
  return data || [];
}

async function addFoodEntry(entry) {
  const { data, error } = await getSupabase()
    .from('food_entries')
    .insert(entry)
    .select()
    .single();
  if (error) console.error('addFoodEntry:', error);
  return { data, error };
}

async function deleteFoodEntry(id) {
  const { error } = await getSupabase()
    .from('food_entries')
    .delete()
    .eq('id', id);
  if (error) console.error('deleteFoodEntry:', error);
  return { error };
}

// ---------- WORKOUTS ----------

async function fetchWorkout(userId, date) {
  const { data, error } = await getSupabase()
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();
  if (error && error.code !== 'PGRST116') console.error('fetchWorkout:', error);
  return data;
}

async function saveWorkout(userId, date, exercises) {
  // Upsert: update if exists, insert if not
  const existing = await fetchWorkout(userId, date);
  if (existing) {
    const { data, error } = await getSupabase()
      .from('workouts')
      .update({ exercises })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) console.error('saveWorkout update:', error);
    return { data, error };
  } else {
    const { data, error } = await getSupabase()
      .from('workouts')
      .insert({ user_id: userId, date, exercises })
      .select()
      .single();
    if (error) console.error('saveWorkout insert:', error);
    return { data, error };
  }
}

// ---------- WORKOUT PLANS ----------

async function fetchWorkoutPlans(userId) {
  const { data, error } = await getSupabase()
    .from('workout_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) console.error('fetchWorkoutPlans:', error);
  return data || [];
}

async function createWorkoutPlan(plan) {
  const { data, error } = await getSupabase()
    .from('workout_plans')
    .insert(plan)
    .select()
    .single();
  if (error) console.error('createWorkoutPlan:', error);
  return { data, error };
}

async function updateWorkoutPlan(id, updates) {
  const { data, error } = await getSupabase()
    .from('workout_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) console.error('updateWorkoutPlan:', error);
  return { data, error };
}

async function deleteWorkoutPlan(id) {
  const { error } = await getSupabase()
    .from('workout_plans')
    .delete()
    .eq('id', id);
  if (error) console.error('deleteWorkoutPlan:', error);
  return { error };
}

// ---------- USER GOALS ----------

async function fetchGoals(userId) {
  const stored = localStorage.getItem(`goals_${userId}`);
  return stored ? JSON.parse(stored) : null;
}

async function saveGoalsData(userId, goals) {
  localStorage.setItem(`goals_${userId}`, JSON.stringify(goals));
}
