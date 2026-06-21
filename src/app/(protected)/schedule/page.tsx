export default function SchedulePage() {
  return (
    <div>
      <h1 className="font-heading font-bold text-3xl text-cream mb-2">Schedule</h1>
      <p className="text-muted mb-8">View the full camp schedule</p>
      <div className="glass-card rounded-2xl p-12 text-center">
        <span className="text-5xl mb-4 block">📅</span>
        <h2 className="font-heading font-semibold text-xl text-cream mb-2">No schedule yet</h2>
        <p className="text-muted">Create camp years and activities to build your schedule.</p>
      </div>
    </div>
  );
}
