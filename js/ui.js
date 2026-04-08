// ============================================
// UI — Rendering Functions
// ============================================

// ---------- TOAST ----------

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-16px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ---------- DATE ----------

function formatDate(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const d = new Date(date + 'T00:00:00');
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDateString(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ---------- MACRO SUMMARY ----------

function renderMacroSummary(totals, goals) {
  const cal = document.getElementById('total-cal');
  const protein = document.getElementById('total-protein');
  const carbs = document.getElementById('total-carbs');
  const fat = document.getElementById('total-fat');
  if (!cal) return;

  cal.textContent = Math.round(totals.calories);
  protein.textContent = Math.round(totals.protein) + 'g';
  carbs.textContent = Math.round(totals.carbs) + 'g';
  fat.textContent = Math.round(totals.fat) + 'g';

  // Progress bars
  if (goals) {
    setBar('bar-cal', totals.calories, goals.calories);
    setBar('bar-protein', totals.protein, goals.protein);
    setBar('bar-carbs', totals.carbs, goals.carbs);
    setBar('bar-fat', totals.fat, goals.fat);
  }
}

function setBar(id, current, target) {
  const bar = document.getElementById(id);
  if (!bar || !target) return;
  const pct = Math.min((current / target) * 100, 100);
  bar.style.width = pct + '%';
}

// ---------- FOOD LIST ----------

function renderFoodList(entries) {
  const list = document.getElementById('food-list');
  const count = document.getElementById('food-count');
  if (!list) return;

  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍽</div>
        <div class="empty-state-text">No food logged yet. Search above to add.</div>
      </div>`;
    if (count) count.textContent = '0 items';
    return;
  }

  if (count) count.textContent = entries.length + ' item' + (entries.length !== 1 ? 's' : '');

  list.innerHTML = entries.map(entry => `
    <div class="food-item">
      <div class="food-item-info">
        <div class="food-item-name">${escapeHtml(entry.food_name)}</div>
        <div class="food-item-macros">
          <span><span class="dot" style="background:var(--protein-color)"></span>${Math.round(entry.protein)}p</span>
          <span><span class="dot" style="background:var(--carbs-color)"></span>${Math.round(entry.carbs)}c</span>
          <span><span class="dot" style="background:var(--fat-color)"></span>${Math.round(entry.fat)}f</span>
        </div>
      </div>
      <div class="food-item-cal">${Math.round(entry.calories)}</div>
      <button class="food-item-delete" onclick="removeFoodEntry('${entry.id}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');
}

// ---------- FOOD SEARCH DROPDOWN ----------

function renderFoodDropdown(results, query) {
  const dropdown = document.getElementById('food-dropdown');
  if (!dropdown) return;

  if (!results.length && !query.trim()) {
    dropdown.classList.remove('visible');
    return;
  }

  let html = results.map((r, i) => `
    <div class="search-result" onclick="selectFoodResult(${i})">
      <div class="search-result-name">${escapeHtml(r.name)}</div>
      <div class="search-result-meta">${Math.round(r.calories)} cal · ${Math.round(r.protein)}p · ${Math.round(r.carbs)}c · ${Math.round(r.fat)}f</div>
      <span class="search-result-source">${r.source}</span>
    </div>
  `).join('');

  // Always show AI option when there's a query
  if (query.trim()) {
    html += `
      <div class="search-ai-option" onclick="estimateWithAI()">
        ✨ Estimate with AI: "${escapeHtml(query.trim())}"
      </div>`;
  }

  dropdown.innerHTML = html;
  dropdown.classList.add('visible');
}

function hideFoodDropdown() {
  const dropdown = document.getElementById('food-dropdown');
  if (dropdown) dropdown.classList.remove('visible');
}

// ---------- SERVING MODAL ----------

function showServingModal(food) {
  document.getElementById('modal-food-name').textContent = food.name;
  document.getElementById('serving-qty').value = 1;
  document.getElementById('serving-unit').textContent = food.servingUnit || 'serving';
  document.getElementById('serving-modal').classList.add('visible');
  updateServingPreview();
}

function closeServingModal() {
  document.getElementById('serving-modal').classList.remove('visible');
}

function renderServingPreview(macros) {
  document.getElementById('preview-cal').textContent = Math.round(macros.calories);
  document.getElementById('preview-protein').textContent = Math.round(macros.protein) + 'g';
  document.getElementById('preview-carbs').textContent = Math.round(macros.carbs) + 'g';
  document.getElementById('preview-fat').textContent = Math.round(macros.fat) + 'g';
}

// ---------- REFINE MODAL ----------

function showRefineModal(description) {
  document.getElementById('refine-input').value = description;
  document.getElementById('refine-modal').classList.add('visible');
}

function closeRefineModal() {
  document.getElementById('refine-modal').classList.remove('visible');
}

// ---------- WORKOUT LIST ----------

function renderWorkoutList(exercises) {
  const list = document.getElementById('workout-list');
  if (!list) return;

  if (!exercises || !exercises.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💪</div>
        <div class="empty-state-text">No exercises yet. Add one or use the AI builder.</div>
      </div>`;
    return;
  }

  list.innerHTML = exercises.map((ex, i) => `
    <div class="exercise-item">
      <div class="exercise-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><rect x="7.5" y="6" width="9" height="12" rx="1"/></svg>
      </div>
      <div class="exercise-item-info">
        <div class="exercise-item-name">${escapeHtml(ex.name)}</div>
        <div class="exercise-item-detail">${ex.sets}×${ex.reps}${ex.weight ? ' @ ' + ex.weight + ' lbs' : ''}</div>
      </div>
      <span class="exercise-item-muscle">${escapeHtml(ex.muscle_group || '')}</span>
      <button class="food-item-delete" onclick="removeExercise(${i})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');
}

// ---------- EXERCISE SEARCH DROPDOWN ----------

function renderExerciseDropdown(results) {
  const dropdown = document.getElementById('exercise-dropdown');
  if (!dropdown) return;

  if (!results.length) {
    dropdown.innerHTML = `
      <div class="search-result" onclick="showCustomExercise()">
        <div class="search-result-name">+ Add Custom Exercise</div>
        <div class="search-result-meta">Create your own</div>
      </div>`;
    dropdown.classList.add('visible');
    return;
  }

  let html = results.map((r, i) => `
    <div class="search-result" onclick="selectExerciseResult(${i})">
      <div class="search-result-name">${escapeHtml(r.name)}</div>
      <div class="search-result-meta">${escapeHtml(r.muscle_group || 'General')}</div>
    </div>
  `).join('');

  html += `
    <div class="search-result" onclick="showCustomExercise()">
      <div class="search-result-name">+ Add Custom Exercise</div>
    </div>`;

  dropdown.innerHTML = html;
  dropdown.classList.add('visible');
}

function hideExerciseDropdown() {
  const dropdown = document.getElementById('exercise-dropdown');
  if (dropdown) dropdown.classList.remove('visible');
}

// ---------- AI WORKOUT RESULT ----------

function renderAIWorkoutPreview(exercises) {
  const container = document.getElementById('ai-workout-exercises');
  if (!container) return;

  container.innerHTML = exercises.map(ex => `
    <div class="exercise-item" style="margin-bottom:6px;">
      <div class="exercise-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><rect x="7.5" y="6" width="9" height="12" rx="1"/></svg>
      </div>
      <div class="exercise-item-info">
        <div class="exercise-item-name">${escapeHtml(ex.name)}</div>
        <div class="exercise-item-detail">${ex.sets}×${ex.reps}${ex.weight ? ' @ ' + ex.weight + ' lbs' : ''}</div>
      </div>
      <span class="exercise-item-muscle">${escapeHtml(ex.muscle_group || '')}</span>
    </div>
  `).join('');
}

// ---------- SAVED PLANS ----------

function renderSavedPlans(plans) {
  const container = document.getElementById('saved-plans');
  if (!container) return;

  if (!plans.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No plans saved yet.</div>
      </div>`;
    return;
  }

  container.innerHTML = plans.map(plan => {
    const structure = plan.structure || {};
    const days = Object.keys(structure);
    return `
      <div class="plan-card" onclick="loadPlan('${plan.id}')">
        <div class="flex justify-between items-center">
          <div class="plan-card-name">${escapeHtml(plan.name)}</div>
          <button class="food-item-delete" onclick="event.stopPropagation();removePlan('${plan.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>
        <div class="plan-card-meta">${days.length} day${days.length !== 1 ? 's' : ''}</div>
        <div class="plan-days">
          ${days.map(d => `<span class="plan-day-chip">${escapeHtml(d)}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderPlanSelect(plans) {
  const container = document.getElementById('plan-list-select');
  if (!container) return;

  if (!plans.length) {
    container.innerHTML = '<p class="text-sm text-muted">No existing plans.</p>';
    return;
  }

  container.innerHTML = plans.map(plan => `
    <div class="plan-card" onclick="selectPlanForSave('${plan.id}','${escapeHtml(plan.name)}')" id="plan-sel-${plan.id}">
      <div class="plan-card-name">${escapeHtml(plan.name)}</div>
    </div>
  `).join('');
}

// ---------- GOALS ----------

function renderGoalTargets(goals) {
  if (!goals) return;
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };
  el('target-cal', Math.round(goals.calories));
  el('target-protein', Math.round(goals.protein) + 'g');
  el('target-carbs', Math.round(goals.carbs) + 'g');
  el('target-fat', Math.round(goals.fat) + 'g');
}

// ---------- USER MENU ----------

function renderUserAvatar(email) {
  const btn = document.getElementById('user-avatar');
  if (btn && email) {
    btn.textContent = email.charAt(0).toUpperCase();
  }
}

// ---------- HELPERS ----------

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function selectChip(el, groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.ai-option-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function getSelectedChip(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return '';
  const sel = group.querySelector('.ai-option-chip.selected');
  return sel ? sel.dataset.value : '';
}
