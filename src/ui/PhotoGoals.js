import LanguageManager from '../i18n/LanguageManager';

export function photoGoalsText(goals) {
    return goals.map(goal => {
        const label = LanguageManager.t(`beautyGoal${goal.type[0].toUpperCase()}${goal.type.slice(1)}`);
        const count = goal.remaining === undefined ? String(goal.count) : goal.target === 'blocker'
            ? LanguageManager.t('beautyGoalRemaining', { count: goal.remaining })
            : `${Math.max(0, goal.count - goal.remaining)}/${goal.count}`;
        return `${label} ${count}`;
    }).join(' · ');
}
