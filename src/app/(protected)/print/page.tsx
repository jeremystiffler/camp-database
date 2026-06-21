export default function PrintPage() {
  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-cream mb-2">Print Center</h1>
      <p className="text-muted mb-8">Generate schedules, rosters, and badges</p>
      <div className="glass-card rounded-2xl p-12 text-center">
        <span className="text-5xl mb-4 block">🖨️</span>
        <h2 className="font-heading font-semibold text-xl text-cream mb-2">Nothing to print yet</h2>
        <p className="text-muted">Print materials will be available once you have campers and activities.</p>
      </div>
    </div>
  );
}
