type InboundSectionPlaceholderPageProps = {
  title: string;
  description: string;
};

export default function InboundSectionPlaceholderPage({ title, description }: InboundSectionPlaceholderPageProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
        <span className="text-2xl font-black">W</span>
      </div>
      <h1 className="mt-4 text-2xl font-black text-slate-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-slate-500">{description}</p>
    </div>
  );
}
