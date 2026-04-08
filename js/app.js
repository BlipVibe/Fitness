// ============================================
// APP.JS — Core Logic + API Integrations
// ============================================

let currentUser = null;
let currentDate = new Date();
let currentPage = 'food';

// Food state
let foodEntries = [];
let foodSearchResults = [];
let selectedFood = null;
let userGoals = null;

// Workout state
let todayExercises = [];
let exerciseSearchResults = [];
let selectedExercise = null;
let aiGeneratedWorkout = [];
let workoutPlans = [];
let selectedPlanId = null;

// Debounce timer
let searchTimer = null;

// ============================================
// INIT
// ============================================

async function initApp(page) {
  currentPage = page;
  currentUser = await requireAuth();
  if (!currentUser) return;

  renderUserAvatar(currentUser.email);
  updateDateLabel();

  // Load goals
  userGoals = await fetchGoals(currentUser.id);
  if (!userGoals) {
    userGoals = { calories: 2000, protein: 150, carbs: 225, fat: 67 };
  }

  if (page === 'food') {
    await loadFoodEntries();
    renderGoalTargets(userGoals);

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) hideFoodDropdown();
      if (!e.target.closest('#user-menu') && !e.target.closest('#user-avatar')) {
        document.getElementById('user-menu')?.classList.add('hidden');
      }
    });
  }

  if (page === 'workout') {
    await loadTodayWorkout();
    await loadWorkoutPlans();

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) hideExerciseDropdown();
      if (!e.target.closest('#user-menu') && !e.target.closest('#user-avatar')) {
        document.getElementById('user-menu')?.classList.add('hidden');
      }
    });
  }
}

// ============================================
// DATE NAVIGATION
// ============================================

function changeDate(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  updateDateLabel();
  if (currentPage === 'food') loadFoodEntries();
  if (currentPage === 'workout') loadTodayWorkout();
}

function updateDateLabel() {
  const label = document.getElementById('date-label');
  if (label) label.textContent = formatDate(getDateString(currentDate));
}

// ============================================
// USER MENU
// ============================================

function toggleUserMenu() {
  document.getElementById('user-menu')?.classList.toggle('hidden');
}

async function handleLogout() {
  await signOut();
  window.location.href = 'login.html';
}

// ============================================
// FOOD: SEARCH
// ============================================

function handleFoodSearch(query) {
  clearTimeout(searchTimer);
  if (!query.trim()) {
    hideFoodDropdown();
    foodSearchResults = [];
    return;
  }
  searchTimer = setTimeout(() => searchFood(query.trim()), 350);
}

async function searchFood(query) {
  foodSearchResults = [];

  // Query USDA + OpenFoodFacts in parallel
  const [usdaResults, offResults] = await Promise.all([
    searchUSDA(query),
    searchOpenFoodFacts(query)
  ]);

  foodSearchResults = [...usdaResults, ...offResults];
  renderFoodDropdown(foodSearchResults, query);
}

// ---------- USDA API ----------

async function searchUSDA(query) {
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&api_key=${CONFIG.USDA_API_KEY}`
    );
    const data = await res.json();
    if (!data.foods) return [];

    return data.foods.slice(0, 5).map(food => {
      const get = (id) => {
        const n = food.foodNutrients?.find(n => n.nutrientId === id);
        return n ? n.value : 0;
      };
      return {
        name: food.description,
        calories: get(1008),
        protein: get(1003),
        carbs: get(1005),
        fat: get(1004),
        servingUnit: 'serving (100g)',
        source: 'USDA'
      };
    });
  } catch (e) {
    console.error('USDA search error:', e);
    return [];
  }
}

// ---------- OpenFoodFacts API ----------

async function searchOpenFoodFacts(query) {
  try {
    const res = await fetch(
      `${CONFIG.OPENFOODFACTS_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`
    );
    const data = await res.json();
    if (!data.products) return [];

    return data.products
      .filter(p => p.nutriments && p.product_name)
      .slice(0, 5)
      .map(p => ({
        name: p.product_name,
        calories: p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'] || 0,
        protein: p.nutriments.proteins_100g || 0,
        carbs: p.nutriments.carbohydrates_100g || 0,
        fat: p.nutriments.fat_100g || 0,
        servingUnit: 'serving (100g)',
        source: 'OpenFoodFacts'
      }));
  } catch (e) {
    console.error('OpenFoodFacts search error:', e);
    return [];
  }
}

// ---------- AI Estimation (OpenAI) ----------

async function estimateWithAI() {
  const query = document.getElementById('food-search').value.trim();
  if (!query) return;

  hideFoodDropdown();
  showToast('Estimating with AI...', 'success');

  const macros = await callOpenAIFood(query);
  if (!macros) {
    showToast('AI estimation failed.', 'error');
    return;
  }

  selectedFood = {
    name: query,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    servingUnit: 'serving',
    source: 'AI Estimate'
  };

  showServingModal(selectedFood);

  // Show refine option after a moment
  setTimeout(() => {
    if (confirm('Would you like to refine this estimate?')) {
      showRefineModal(query);
    }
  }, 500);
}

async function callOpenAIFood(description) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are a nutrition expert. Estimate calories and macros for foods. Return ONLY valid JSON: {"calories": number, "protein": number, "carbs": number, "fat": number}. Be realistic. Assume standard portion unless specified. No markdown, no explanation.'
        }, {
          role: 'user',
          content: `Estimate calories and macros for: ${description}`
        }],
        temperature: 0.3,
        max_tokens: 100
      })
    });
    const data = await res.json();
    const content = data.choices[0].message.content.trim();
    return JSON.parse(content);
  } catch (e) {
    console.error('OpenAI food error:', e);
    return null;
  }
}

async function handleRefine() {
  const input = document.getElementById('refine-input').value.trim();
  if (!input) return;

  const btn = document.getElementById('refine-btn');
  btn.disabled = true;
  btn.textContent = 'Estimating...';

  const macros = await callOpenAIFood(input);
  btn.disabled = false;
  btn.textContent = 'Re-estimate';

  if (!macros) {
    showToast('Refinement failed.', 'error');
    return;
  }

  selectedFood = {
    name: input,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    servingUnit: 'serving',
    source: 'AI Estimate'
  };

  closeRefineModal();
  showServingModal(selectedFood);
}

// ============================================
// FOOD: SELECT + ADD
// ============================================

function selectFoodResult(index) {
  selectedFood = foodSearchResults[index];
  hideFoodDropdown();
  showServingModal(selectedFood);
}

function updateServingPreview() {
  if (!selectedFood) return;
  const qty = parseFloat(document.getElementById('serving-qty').value) || 1;
  renderServingPreview({
    calories: selectedFood.calories * qty,
    protein: selectedFood.protein * qty,
    carbs: selectedFood.carbs * qty,
    fat: selectedFood.fat * qty
  });
}

async function confirmAddFood() {
  if (!selectedFood) return;
  const qty = parseFloat(document.getElementById('serving-qty').value) || 1;

  const entry = {
    user_id: currentUser.id,
    food_name: selectedFood.name,
    calories: Math.round(selectedFood.calories * qty * 10) / 10,
    protein: Math.round(selectedFood.protein * qty * 10) / 10,
    carbs: Math.round(selectedFood.carbs * qty * 10) / 10,
    fat: Math.round(selectedFood.fat * qty * 10) / 10,
    date: getDateString(currentDate)
  };

  const { error } = await addFoodEntry(entry);
  if (error) {
    showToast('Failed to add food.', 'error');
    return;
  }

  closeServingModal();
  document.getElementById('food-search').value = '';
  selectedFood = null;
  showToast('Food added!');
  await loadFoodEntries();
}

// ============================================
// FOOD: LOAD + DELETE
// ============================================

async function loadFoodEntries() {
  foodEntries = await fetchFoodEntries(currentUser.id, getDateString(currentDate));
  renderFoodList(foodEntries);

  const totals = foodEntries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein: acc.protein + (e.protein || 0),
    carbs: acc.carbs + (e.carbs || 0),
    fat: acc.fat + (e.fat || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  renderMacroSummary(totals, userGoals);
}

async function removeFoodEntry(id) {
  await deleteFoodEntry(id);
  showToast('Removed.');
  await loadFoodEntries();
}

// ============================================
// GOALS
// ============================================

function toggleGoals() {
  const panel = document.getElementById('goals-panel');
  if (!panel) {
    window.location.href = 'food.html';
    return;
  }
  panel.classList.toggle('visible');
  if (userGoals) {
    renderGoalTargets(userGoals);
  }
}

function closeGoals() {
  document.getElementById('goals-panel')?.classList.remove('visible');
}

function selectGoal(el) {
  el.parentElement.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  calculateGoals();
}

function selectActivity(el) {
  el.parentElement.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  calculateGoals();
}

function calculateGoals() {
  const weight = parseFloat(document.getElementById('goal-weight')?.value) || 170;
  const goalType = document.querySelector('#goal-type .selected')?.dataset.value || 'maintain';
  const activity = document.querySelector('#goal-activity .selected')?.dataset.value || 'moderate';

  // BMR estimate (Mifflin-St Jeor simplified, assuming avg height/age)
  let bmr = weight * 6.8 + 655; // rough approx
  const multipliers = { sedentary: 1.2, moderate: 1.55, active: 1.8 };
  let tdee = bmr * (multipliers[activity] || 1.55);

  if (goalType === 'lose') tdee -= 500;
  if (goalType === 'gain') tdee += 300;

  const protein = weight * 0.9;
  const fat = tdee * 0.25 / 9;
  const carbs = (tdee - protein * 4 - fat * 9) / 4;

  const goals = {
    calories: Math.round(tdee),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat)
  };

  renderGoalTargets(goals);
  return goals;
}

async function saveGoals() {
  // Check manual overrides first
  const manualCal = parseFloat(document.getElementById('manual-cal')?.value);
  const manualProtein = parseFloat(document.getElementById('manual-protein')?.value);
  const manualFat = parseFloat(document.getElementById('manual-fat')?.value);

  let goals;
  if (manualCal) {
    const protein = manualProtein || 150;
    const fat = manualFat || 67;
    const carbs = (manualCal - protein * 4 - fat * 9) / 4;
    goals = {
      calories: Math.round(manualCal),
      protein: Math.round(protein),
      carbs: Math.max(0, Math.round(carbs)),
      fat: Math.round(fat)
    };
  } else {
    goals = calculateGoals();
  }

  userGoals = goals;
  await saveGoalsData(currentUser.id, goals);
  renderGoalTargets(goals);
  closeGoals();
  showToast('Goals saved!');

  // Refresh macro bars
  if (currentPage === 'food') await loadFoodEntries();
}

// ============================================
// WORKOUT: LOAD
// ============================================

async function loadTodayWorkout() {
  const workout = await fetchWorkout(currentUser.id, getDateString(currentDate));
  todayExercises = workout?.exercises || [];
  renderWorkoutList(todayExercises);
}

async function loadWorkoutPlans() {
  workoutPlans = await fetchWorkoutPlans(currentUser.id);
  renderSavedPlans(workoutPlans);
}

// ============================================
// WORKOUT: EXERCISE MODAL
// ============================================

function openExerciseModal() {
  document.getElementById('exercise-modal').classList.add('visible');
  document.getElementById('exercise-search').value = '';
  document.getElementById('exercise-selected').classList.add('hidden');
  document.getElementById('custom-exercise-section').classList.add('hidden');
  hideExerciseDropdown();
  selectedExercise = null;
}

function closeExerciseModal() {
  document.getElementById('exercise-modal').classList.remove('visible');
}

function handleExerciseSearch(query) {
  clearTimeout(searchTimer);
  if (!query.trim()) {
    hideExerciseDropdown();
    return;
  }
  searchTimer = setTimeout(() => searchExercises(query.trim()), 350);
}

async function searchExercises(query) {
  exerciseSearchResults = [];
  try {
    const res = await fetch(
      `${CONFIG.WGER_URL}/exercise/search/?term=${encodeURIComponent(query)}&language=english&format=json`
    );
    const data = await res.json();

    if (data.suggestions && data.suggestions.length) {
      exerciseSearchResults = data.suggestions.map(s => ({
        name: s.data.name,
        muscle_group: getMuscleGroup(s.data.muscles || []),
        wger_id: s.data.id
      }));
    }
  } catch (e) {
    console.error('Wger search error:', e);
  }

  renderExerciseDropdown(exerciseSearchResults);
}

function getMuscleGroup(muscles) {
  const muscleMap = {
    1: 'Biceps', 2: 'Deltoids', 3: 'Chest', 4: 'Triceps',
    5: 'Abs', 6: 'Calves', 7: 'Glutes', 8: 'Hamstrings',
    9: 'Lats', 10: 'Quadriceps', 11: 'Traps', 12: 'Lower Back',
    13: 'Shoulders', 14: 'Forearms', 15: 'Obliques'
  };
  if (!muscles.length) return 'General';
  return muscles.map(m => muscleMap[m.id || m] || 'General').join(', ');
}

function selectExerciseResult(index) {
  selectedExercise = exerciseSearchResults[index];
  hideExerciseDropdown();

  document.getElementById('exercise-selected').classList.remove('hidden');
  document.getElementById('custom-exercise-section').classList.add('hidden');
  document.getElementById('sel-exercise-name').value = selectedExercise.name;
  document.getElementById('sel-exercise-muscle').value = selectedExercise.muscle_group;
}

function showCustomExercise() {
  hideExerciseDropdown();
  document.getElementById('exercise-selected').classList.add('hidden');
  document.getElementById('custom-exercise-section').classList.remove('hidden');
  selectedExercise = null;
}

async function confirmAddExercise() {
  let exercise;

  if (selectedExercise) {
    exercise = {
      name: selectedExercise.name,
      muscle_group: selectedExercise.muscle_group,
      sets: parseInt(document.getElementById('sel-sets').value) || 3,
      reps: parseInt(document.getElementById('sel-reps').value) || 10,
      weight: parseInt(document.getElementById('sel-weight').value) || 0
    };
  } else {
    const name = document.getElementById('custom-exercise-name').value.trim();
    if (!name) {
      showToast('Enter an exercise name.', 'error');
      return;
    }
    exercise = {
      name: name,
      muscle_group: document.getElementById('custom-exercise-muscle').value.trim() || 'General',
      sets: parseInt(document.getElementById('custom-sets').value) || 3,
      reps: parseInt(document.getElementById('custom-reps').value) || 10,
      weight: parseInt(document.getElementById('custom-weight').value) || 0
    };
  }

  todayExercises.push(exercise);
  await saveWorkout(currentUser.id, getDateString(currentDate), todayExercises);
  renderWorkoutList(todayExercises);
  closeExerciseModal();
  showToast('Exercise added!');
}

async function removeExercise(index) {
  todayExercises.splice(index, 1);
  await saveWorkout(currentUser.id, getDateString(currentDate), todayExercises);
  renderWorkoutList(todayExercises);
  showToast('Removed.');
}

// ============================================
// WORKOUT: AI BUILDER
// ============================================

function openAIWorkoutModal() {
  document.getElementById('ai-workout-modal').classList.add('visible');
  document.getElementById('ai-workout-form').classList.remove('hidden');
  document.getElementById('ai-workout-result').classList.add('hidden');
}

function closeAIWorkoutModal() {
  document.getElementById('ai-workout-modal').classList.remove('visible');
}

function resetAIBuilder() {
  document.getElementById('ai-workout-form').classList.remove('hidden');
  document.getElementById('ai-workout-result').classList.add('hidden');
}

async function generateAIWorkout() {
  const goal = document.getElementById('ai-workout-goal').value.trim();
  if (!goal) {
    showToast('Describe your training goal.', 'error');
    return;
  }

  const experience = getSelectedChip('ai-experience');
  const time = getSelectedChip('ai-time');
  const equipment = getSelectedChip('ai-equipment');

  const btn = document.getElementById('ai-generate-btn');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You are a certified personal trainer. Generate a workout plan. Return ONLY valid JSON array: [{"name": "Exercise Name", "sets": 3, "reps": 10, "muscle_group": "Chest", "weight": 0}]. Use common gym exercise names. No markdown, no explanation.`
        }, {
          role: 'user',
          content: `Generate a workout for:
- Goal: ${goal}
- Experience: ${experience}
- Time: ${time} minutes
- Equipment: ${equipment}

Return 5-8 exercises as JSON array.`
        }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await res.json();
    const content = data.choices[0].message.content.trim();

    // Parse — handle potential markdown code blocks
    let parsed = content;
    if (content.startsWith('```')) {
      parsed = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    aiGeneratedWorkout = JSON.parse(parsed);

    document.getElementById('ai-workout-form').classList.add('hidden');
    document.getElementById('ai-workout-result').classList.remove('hidden');
    renderAIWorkoutPreview(aiGeneratedWorkout);

  } catch (e) {
    console.error('AI workout error:', e);
    showToast('Failed to generate workout.', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Generate Workout';
}

async function useAIWorkout() {
  todayExercises = [...todayExercises, ...aiGeneratedWorkout];
  await saveWorkout(currentUser.id, getDateString(currentDate), todayExercises);
  renderWorkoutList(todayExercises);
  closeAIWorkoutModal();
  showToast('Workout added!');
}

// ============================================
// WORKOUT: PLANS
// ============================================

function openSavePlanModal() {
  if (!todayExercises.length) {
    showToast('Add exercises first.', 'error');
    return;
  }
  selectedPlanId = null;
  document.getElementById('new-plan-name').value = '';
  document.getElementById('plan-day-label').value = '';
  renderPlanSelect(workoutPlans);
  document.getElementById('save-plan-modal').classList.add('visible');
}

function closeSavePlanModal() {
  document.getElementById('save-plan-modal').classList.remove('visible');
}

function selectPlanForSave(planId, planName) {
  selectedPlanId = planId;
  // Highlight selected
  document.querySelectorAll('[id^="plan-sel-"]').forEach(el => {
    el.style.borderLeft = el.id === `plan-sel-${planId}` ? '3px solid var(--accent)' : 'none';
  });
  document.getElementById('new-plan-name').value = '';
}

async function confirmSavePlan() {
  const dayLabel = document.getElementById('plan-day-label').value.trim() || 'Day 1';
  const newName = document.getElementById('new-plan-name').value.trim();

  if (selectedPlanId) {
    // Add to existing plan
    const plan = workoutPlans.find(p => p.id === selectedPlanId);
    if (!plan) return;
    const structure = plan.structure || {};
    structure[dayLabel] = todayExercises;
    await updateWorkoutPlan(plan.id, { structure });
  } else if (newName) {
    // Create new plan
    const structure = {};
    structure[dayLabel] = todayExercises;
    await createWorkoutPlan({
      user_id: currentUser.id,
      name: newName,
      structure
    });
  } else {
    showToast('Enter a plan name or select existing.', 'error');
    return;
  }

  closeSavePlanModal();
  await loadWorkoutPlans();
  showToast('Plan saved!');
}

async function loadPlan(planId) {
  const plan = workoutPlans.find(p => p.id === planId);
  if (!plan || !plan.structure) return;

  const days = Object.keys(plan.structure);
  if (days.length === 1) {
    todayExercises = [...plan.structure[days[0]]];
  } else {
    // Let user pick a day
    const day = prompt(`Choose a day:\n${days.join('\n')}`);
    if (!day || !plan.structure[day]) return;
    todayExercises = [...plan.structure[day]];
  }

  await saveWorkout(currentUser.id, getDateString(currentDate), todayExercises);
  renderWorkoutList(todayExercises);
  showToast(`Loaded: ${plan.name}`);
}

async function removePlan(planId) {
  await deleteWorkoutPlan(planId);
  await loadWorkoutPlans();
  showToast('Plan deleted.');
}
