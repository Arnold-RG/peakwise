export function MoleculeSvg({ svg, className = "" }: { svg?: string | null; className?: string }) {
  if (!svg) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 ${className}`}>
        No structure
      </div>
    );
  }
  return (
    <div
      className={`mol-wrap overflow-hidden rounded-xl bg-zinc-50 dark:bg-[#0c0c0f] ${className}`}
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg", '<svg class="mol-svg"') }}
    />
  );
}
