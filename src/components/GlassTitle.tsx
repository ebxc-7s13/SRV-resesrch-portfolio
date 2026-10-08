export default function GlassTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={"original-glass-title " + className}>{children}</div>;
}
